"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Upload, Download, RotateCcw, Palette } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface ColorReplacement {
  from: string
  to: string
  tolerance: number
  makeTransparent: boolean
}



export default function ImageColorChanger() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [processedImageData, setProcessedImageData] = useState<ImageData | null>(null)
  const [colorReplacements, setColorReplacements] = useState<ColorReplacement[]>([
    { from: "#ff0000", to: "#00ff00", tolerance: 30, makeTransparent: false },
  ])
  const [isProcessing, setIsProcessing] = useState(false)


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
    // Use squared distance to avoid expensive sqrt operation
    const dr = color1.r - color2.r
    const dg = color1.g - color2.g
    const db = color1.b - color2.b
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  const processImage = useCallback(async () => {
    if (!originalImage) return

    setIsProcessing(true)

    // Use setTimeout to make processing asynchronous
    setTimeout(async () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setIsProcessing(false)
        return
      }

      canvas.width = originalImage.width
      canvas.height = originalImage.height
      ctx.drawImage(originalImage, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Pre-calculate color values for better performance
      const replacements = colorReplacements.map(replacement => {
        const fromColor = hexToRgb(replacement.from)
        const toColor = replacement.makeTransparent ? null : hexToRgb(replacement.to)
        return {
          from: fromColor,
          to: toColor,
          tolerance: replacement.tolerance,
          makeTransparent: replacement.makeTransparent,
          valid: fromColor && (replacement.makeTransparent || toColor)
        }
      }).filter(r => r.valid)

      // Process in chunks to avoid blocking the main thread
      const chunkSize = 40000 // Process 10,000 pixels at a time
      let pixelIndex = 0

      const processChunk = () => {
        const endIndex = Math.min(pixelIndex + chunkSize, data.length)
        
        for (let i = pixelIndex; i < endIndex; i += 4) {
          const currentColor = { r: data[i], g: data[i + 1], b: data[i + 2] }

          for (const replacement of replacements) {
            if (replacement.from) {
              const distance = colorDistance(currentColor, replacement.from)
              if (distance <= replacement.tolerance) {
                if (replacement.makeTransparent) {
                  // Make pixel transparent
                  data[i + 3] = 0
                } else if (replacement.to) {
                  // Replace with target color
                  data[i] = replacement.to.r
                  data[i + 1] = replacement.to.g
                  data[i + 2] = replacement.to.b
                }
                break
              }
            }
          }
        }

        pixelIndex = endIndex

        if (pixelIndex < data.length) {
          // Continue processing in next frame
          requestAnimationFrame(processChunk)
        } else {
          // Processing complete
          setProcessedImageData(imageData)
          setIsProcessing(false)
        }
      }

      // Start processing
      processChunk()
    }, 10)
  }, [originalImage, colorReplacements])

  useEffect(() => {
    if (originalImage) {
      // Debounce processing to avoid excessive re-processing
      const timeoutId = setTimeout(() => {
        processImage()
      }, 300) // Wait 300ms after last change

      return () => clearTimeout(timeoutId)
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
    setColorReplacements([...colorReplacements, { from: "#ff0000", to: "#00ff00", tolerance: 30, makeTransparent: false }])
  }

  const removeColorReplacement = (index: number) => {
    setColorReplacements(colorReplacements.filter((_, i) => i !== index))
  }

  const updateColorReplacement = (index: number, field: keyof ColorReplacement, value: string | number | boolean) => {
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
    setColorReplacements([{ from: "#ff0000", to: "#00ff00", tolerance: 30, makeTransparent: false }])
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
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={replacement.from}
                                  onChange={(e) => updateColorReplacement(index, "from", e.target.value)}
                                  className="w-12 h-10 p-1 border rounded cursor-pointer"
                                />
                              </div>
                              <Input
                                type="text"
                                value={replacement.from}
                                onChange={(e) => updateColorReplacement(index, "from", e.target.value)}
                                className="flex-1 h-10 text-xs font-mono"
                                placeholder="#ffffff"
                              />
                            </div>
                          </div>

                          {/* To Color Section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium text-gray-700">To Color</Label>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`transparent-${index}`}
                                  checked={replacement.makeTransparent}
                                  onCheckedChange={(checked) => updateColorReplacement(index, "makeTransparent", checked === true)}
                                />
                                <Label 
                                  htmlFor={`transparent-${index}`} 
                                  className="text-xs font-medium text-gray-600 cursor-pointer"
                                >
                                  Make Transparent
                                </Label>
                              </div>
                            </div>
                            <div className={`flex items-center gap-3 ${replacement.makeTransparent ? 'opacity-40 pointer-events-none' : ''}`}>
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={replacement.to}
                                  onChange={(e) => updateColorReplacement(index, "to", e.target.value)}
                                  className="w-12 h-10 p-1 border rounded cursor-pointer"
                                  disabled={replacement.makeTransparent}
                                />
                              </div>
                              <Input
                                type="text"
                                value={replacement.makeTransparent ? "Transparent" : replacement.to}
                                onChange={(e) => updateColorReplacement(index, "to", e.target.value)}
                                className="flex-1 h-10 text-xs font-mono"
                                placeholder="#ffffff"
                                disabled={replacement.makeTransparent}
                              />
                            </div>
                            {replacement.makeTransparent && (
                              <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mt-1">
                                ℹ️ Image will be saved as PNG to preserve transparency
                              </p>
                            )}
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


      </div>
    </div>
  )
}
