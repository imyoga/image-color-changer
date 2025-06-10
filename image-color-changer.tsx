"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Upload, Download, RotateCcw, Palette, Pipette } from "lucide-react"
import { Input } from "@/components/ui/input"

interface ColorReplacement {
  from: string
  to: string
  tolerance: number
}

interface ColorPreviewPosition {
  x: number
  y: number
  visible: boolean
  color: string
}

export default function ImageColorChanger() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [processedImageData, setProcessedImageData] = useState<ImageData | null>(null)
  const [colorReplacements, setColorReplacements] = useState<ColorReplacement[]>([
    { from: "#ff0000", to: "#00ff00", tolerance: 30 },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [pickingColor, setPickingColor] = useState<{ index: number; type: "from" | "to" } | null>(null)
  const [colorPreview, setColorPreview] = useState<ColorPreviewPosition>({
    x: 0,
    y: 0,
    visible: false,
    color: "#ffffff",
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const processedCanvasRef = useRef<HTMLCanvasElement>(null)
  const colorPickerCanvasRef = useRef<HTMLCanvasElement>(null)

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : null
  }

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }

  const colorDistance = (color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }) => {
    return Math.sqrt(
      Math.pow(color1.r - color2.r, 2) + Math.pow(color1.g - color2.g, 2) + Math.pow(color1.b - color2.b, 2),
    )
  }

  const processImage = useCallback(() => {
    if (!originalImage) return

    setIsProcessing(true)

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = originalImage.width
    canvas.height = originalImage.height
    ctx.drawImage(originalImage, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const currentColor = { r: data[i], g: data[i + 1], b: data[i + 2] }

      for (const replacement of colorReplacements) {
        const fromColor = hexToRgb(replacement.from)
        const toColor = hexToRgb(replacement.to)

        if (fromColor && toColor) {
          const distance = colorDistance(currentColor, fromColor)
          if (distance <= replacement.tolerance) {
            data[i] = toColor.r
            data[i + 1] = toColor.g
            data[i + 2] = toColor.b
            break
          }
        }
      }
    }

    setProcessedImageData(imageData)
    setIsProcessing(false)
  }, [originalImage, colorReplacements])

  useEffect(() => {
    if (originalImage) {
      processImage()
    }
  }, [originalImage, colorReplacements, processImage])

  useEffect(() => {
    if (processedImageData && processedCanvasRef.current) {
      const ctx = processedCanvasRef.current.getContext("2d")
      if (ctx) {
        processedCanvasRef.current.width = processedImageData.width
        processedCanvasRef.current.height = processedImageData.height
        ctx.putImageData(processedImageData, 0, 0)
      }
    }
  }, [processedImageData])

  useEffect(() => {
    if (originalImage && originalCanvasRef.current) {
      const canvas = originalCanvasRef.current
      const ctx = canvas.getContext("2d")

      if (ctx) {
        // Set canvas dimensions to match the image
        canvas.width = originalImage.width
        canvas.height = originalImage.height

        // Clear canvas and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(originalImage, 0, 0)
        
        // Force a repaint
        canvas.style.display = 'none'
        canvas.offsetHeight // Trigger reflow
        canvas.style.display = 'block'
      }
    }
  }, [originalImage])

  // Setup global color picker
  useEffect(() => {
    if (!pickingColor) {
      setColorPreview((prev) => ({ ...prev, visible: false }))
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Get the color at the cursor position
      const x = e.clientX
      const y = e.clientY

      // Get the element under the cursor
      const element = document.elementFromPoint(x, y)

      if (element) {
        // Get computed style
        const computedStyle = window.getComputedStyle(element)
        const bgColor = computedStyle.backgroundColor

        // Parse the RGB color
        const rgbMatch = bgColor.match(/rgb$$(\d+),\s*(\d+),\s*(\d+)$$/)
        let hexColor = "#ffffff"

        if (rgbMatch) {
          const r = Number.parseInt(rgbMatch[1])
          const g = Number.parseInt(rgbMatch[2])
          const b = Number.parseInt(rgbMatch[3])
          hexColor = rgbToHex(r, g, b)
        } else if (element instanceof HTMLCanvasElement) {
          // If it's a canvas element, try to get pixel data
          try {
            const rect = element.getBoundingClientRect()
            const scaleX = element.width / rect.width
            const scaleY = element.height / rect.height
            const canvasX = Math.floor((x - rect.left) * scaleX)
            const canvasY = Math.floor((y - rect.top) * scaleY)
            const ctx = element.getContext("2d")

            if (ctx && canvasX >= 0 && canvasY >= 0 && canvasX < element.width && canvasY < element.height) {
              const pixelData = ctx.getImageData(canvasX, canvasY, 1, 1).data
              hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2])
            }
          } catch (error) {
            // Fallback if we can't access canvas data
            console.warn("Could not access canvas pixel data:", error)
          }
        }

        // Update color preview
        setColorPreview({
          x: x + 15,
          y: y + 15,
          visible: true,
          color: hexColor,
        })
      }
    }

    const handleClick = (e: MouseEvent) => {
      if (!pickingColor) return

      // Get the current color from the preview
      const hexColor = colorPreview.color

      // Update the color replacement
      setColorReplacements((prev) => {
        const newReplacements = [...prev]
        newReplacements[pickingColor.index][pickingColor.type] = hexColor
        return newReplacements
      })

      // Exit picking mode
      setPickingColor(null)

      // Prevent default to avoid unwanted actions
      e.preventDefault()
      e.stopPropagation()
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPickingColor(null)
      }
    }

    // Add event listeners
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("click", handleClick, true)
    document.addEventListener("keydown", handleEscape)

    // Set cursor
    document.body.style.cursor = "crosshair"

    return () => {
      // Clean up
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("click", handleClick, true)
      document.removeEventListener("keydown", handleEscape)
      document.body.style.cursor = "default"
    }
  }, [pickingColor])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          setOriginalImage(img)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const addColorReplacement = () => {
    setColorReplacements([...colorReplacements, { from: "#ff0000", to: "#00ff00", tolerance: 30 }])
  }

  const removeColorReplacement = (index: number) => {
    setColorReplacements(colorReplacements.filter((_, i) => i !== index))
  }

  const updateColorReplacement = (index: number, field: keyof ColorReplacement, value: string | number) => {
    const newReplacements = [...colorReplacements]
    newReplacements[index] = { ...newReplacements[index], [field]: value }
    setColorReplacements(newReplacements)
  }

  const downloadImage = () => {
    if (processedCanvasRef.current) {
      const link = document.createElement("a")
      link.download = "color-changed-image.png"
      link.href = processedCanvasRef.current.toDataURL()
      link.click()
    }
  }

  const resetImage = () => {
    setOriginalImage(null)
    setProcessedImageData(null)
    setColorReplacements([{ from: "#ff0000", to: "#00ff00", tolerance: 30 }])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Image Color Changer</h1>
          <p className="text-gray-600">Upload an image and replace colors with precision</p>
        </div>

        {!originalImage ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Upload Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-600">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid xl:grid-cols-4 lg:grid-cols-3 gap-8">
            {/* Color Controls */}
            <div className="xl:col-span-2 lg:col-span-1 space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Palette className="h-5 w-5 text-blue-600" />
                    Color Replacements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {colorReplacements.map((replacement, index) => (
                    <div key={index} className="p-6 border rounded-lg space-y-4 bg-gray-50/50">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Replacement {index + 1}</span>
                        {colorReplacements.length > 1 && (
                          <Button variant="outline" size="sm" onClick={() => removeColorReplacement(index)}>
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* From and To Color Sections in One Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* From Color Section */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">From Color</Label>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={replacement.from}
                                  onChange={(e) => updateColorReplacement(index, "from", e.target.value)}
                                  className="w-10 h-9 p-1 border rounded cursor-pointer"
                                />
                              </div>
                              <Input
                                type="text"
                                value={replacement.from}
                                onChange={(e) => updateColorReplacement(index, "from", e.target.value)}
                                className="flex-1 h-9 text-xs font-mono"
                                placeholder="#ffffff"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPickingColor({ index, type: "from" })}
                                className={`h-9 px-2 text-xs ${
                                  pickingColor?.index === index && pickingColor?.type === "from"
                                    ? "bg-blue-100 border-blue-300 text-blue-700"
                                    : ""
                                }`}
                              >
                                <Pipette className="h-3 w-3 mr-1" />
                                Pick
                              </Button>
                            </div>
                          </div>

                          {/* To Color Section */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">To Color</Label>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={replacement.to}
                                  onChange={(e) => updateColorReplacement(index, "to", e.target.value)}
                                  className="w-10 h-9 p-1 border rounded cursor-pointer"
                                />
                              </div>
                              <Input
                                type="text"
                                value={replacement.to}
                                onChange={(e) => updateColorReplacement(index, "to", e.target.value)}
                                className="flex-1 h-9 text-xs font-mono"
                                placeholder="#ffffff"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPickingColor({ index, type: "to" })}
                                className={`h-9 px-2 text-xs ${
                                  pickingColor?.index === index && pickingColor?.type === "to"
                                    ? "bg-blue-100 border-blue-300 text-blue-700"
                                    : ""
                                }`}
                              >
                                <Pipette className="h-3 w-3 mr-1" />
                                Pick
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Tolerance Section */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium text-gray-700">Tolerance</Label>
                            <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {replacement.tolerance}
                            </span>
                          </div>
                          <Slider
                            value={[replacement.tolerance]}
                            onValueChange={(value) => updateColorReplacement(index, "tolerance", value[0])}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Exact match</span>
                            <span>Loose match</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button onClick={addColorReplacement} variant="outline" className="w-full h-12 border-dashed border-2 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                        <span className="text-gray-400 text-lg">+</span>
                      </div>
                      Add Color Replacement
                    </div>
                  </Button>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button onClick={downloadImage} disabled={!processedImageData} className="flex-1 h-12">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={resetImage} variant="outline" className="h-12">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>

            {/* Image Preview */}
            <div className="xl:col-span-2 lg:col-span-2 space-y-6">
              {pickingColor && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-center shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Pipette className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Color Picker Active</span>
                  </div>
                  <p className="text-blue-700 text-sm">
                    Click anywhere on the page to pick a{" "}
                    <span className="font-semibold">
                      {pickingColor.type === "from" ? "source" : "target"}
                    </span>{" "}
                    color
                  </p>
                  <p className="text-blue-600 text-xs mt-1">Press ESC to cancel</p>
                </div>
              )}

                             <div className="space-y-4">
                 {/* Original Image */}
                 <Card className="shadow-sm">
                   <CardContent className="p-3">
                     <div className="mb-2">
                       <h3 className="text-sm font-medium text-gray-600 text-center">Original Image</h3>
                     </div>
                     <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 min-h-[200px] flex items-center justify-center">
                       {originalImage ? (
                         <canvas
                           ref={originalCanvasRef}
                           className="max-w-full max-h-full block"
                           style={{
                             maxHeight: "600px",
                             maxWidth: "100%",
                             display: "block",
                           }}
                         />
                       ) : (
                         <div className="text-gray-500 text-sm">Loading original image...</div>
                       )}
                     </div>
                   </CardContent>
                 </Card>

                 {/* Result Image */}
                 <Card className="shadow-sm">
                   <CardContent className="p-3">
                     <div className="mb-2">
                       <h3 className="text-sm font-medium text-gray-600 text-center">
                         {isProcessing ? (
                           <div className="flex items-center justify-center gap-2">
                             <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                             Processing...
                           </div>
                         ) : (
                           "Result Image"
                         )}
                       </h3>
                     </div>
                     <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                       {isProcessing ? (
                         <div className="flex items-center justify-center h-64 w-full">
                           <div className="text-center">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                             <p className="text-gray-500 text-sm">Processing image...</p>
                           </div>
                         </div>
                       ) : (
                         <canvas
                           ref={processedCanvasRef}
                           className="max-w-full block mx-auto"
                           style={{
                             maxHeight: "600px",
                             maxWidth: "100%",
                             display: "block",
                           }}
                         />
                       )}
                     </div>
                   </CardContent>
                 </Card>
               </div>
            </div>
          </div>
        )}

        {/* Color Preview Tooltip */}
        {colorPreview.visible && (
          <div
            className="fixed z-50 bg-white rounded-md shadow-lg border p-2 pointer-events-none"
            style={{
              left: `${colorPreview.x}px`,
              top: `${colorPreview.y}px`,
              transform: "translate(0, 0)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border rounded" style={{ backgroundColor: colorPreview.color }}></div>
              <span className="text-xs font-mono">{colorPreview.color}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
