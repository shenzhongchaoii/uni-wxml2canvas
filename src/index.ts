export type W2CDrawType = 'IMAGE' | 'CIRCLEIMAGE' | 'TEXT' | 'CIRCLE' | 'RECT' | 'ROUNDRECT'

export interface W2CWxml {
  type: W2CDrawType
  layer?: number
  desc:
    | W2CDrawImage
    | W2CDrawCircleImage
    | W2CDrawText
    | W2CDrawCircle
    | W2CDrawRect
    | W2CDrawRoundRect
}

export interface W2CDrawStartPosition {
  startX: number
  startY: number
}

export interface W2CDrawImage extends W2CDrawStartPosition {
  url: string
  width?: number
  height?: number
}

export interface W2CDrawCircleImage extends W2CDrawStartPosition {
  url: string
  width: number
  height: number
  radius: number
}

export interface W2CDrawText extends W2CDrawStartPosition {
  text: string
  font?: string
  align?: 'left' | 'center' | 'right'
  /** 支持 rgb、rgba、十六进制、颜色英文 */
  fillColor?: string
  maxWidth?: number
  lineHeight?: number
}

export interface W2CDrawCircle extends W2CDrawStartPosition {
  radius: number
  /** 支持 rgb、rgba、十六进制、颜色英文 */
  fillColor: string
  lineWidth?: number
  lineColor?: string
}

export interface W2CDrawRect extends W2CDrawStartPosition {
  width: number
  height: number
  /** 支持 rgb、rgba、十六进制、颜色英文 */
  fillColor: string
  lineWidth?: number
  /** 支持 rgb、rgba、十六进制、颜色英文 */
  lineColor?: string
}

export interface W2CDrawRoundRect extends W2CDrawRect {
  radius: number
}

export class Wxml2Canvas {
  private canvasId: string
  private width: number
  private height: number
  private wxml2ds: W2CWxml[][]

  // @ts-ignore
  private ctx: UniApp.CanvasContext
  private instance: any

  /**
   * 构造函数
   * @param canvasId Canvas ID
   * @param options
   */
  constructor(
    canvasId: string,
    instance: any,
    options: {
      width: number
      height: number
      wxml: W2CWxml | W2CWxml[]
    },
  ) {
    this.canvasId = canvasId
    this.instance = instance

    const { width, height, wxml } = options
    this.width = width
    this.height = height

    this.wxml2ds = this.groupElementsByLayer<W2CWxml>(Array.isArray(wxml) ? wxml : [wxml])
  }

  /**
   * 生成并返回图片路径
   * @returns Promise<string> 返回图片临时路径
   */
  public async generate(): Promise<string> {
    // @ts-ignore
    this.ctx = uni.createCanvasContext(this.canvasId, this.instance)

    if (!this.ctx) {
      throw new Error('Canvas context is not initialized')
    }

    this.ctx.clearRect(0, 0, this.width, this.height)

    // 开始绘制
    await this.draw()

    this.ctx.draw()
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 获取设备信息，处理不同设备像素比
        // @ts-ignore
        const systemInfo = uni.getSystemInfoSync()
        const pixelRatio = systemInfo.pixelRatio || 2
        // @ts-ignore
        uni.canvasToTempFilePath(
          {
            canvasId: this.canvasId,
            width: this.width,
            height: this.height,
            destWidth: this.width * pixelRatio,
            destHeight: this.height * pixelRatio,
            success: (res: Record<'tempFilePath', string>) => {
              resolve(res.tempFilePath)
            },
            fail: (error: any) => {
              reject(error)
            },
          },
          this.instance,
        )
      }, 300) // 短暂延时确保canvas绘制完成
    })
  }

  private async drawWithTypeSelection({ type, desc }: W2CWxml) {
    switch (type) {
      case 'IMAGE':
        await this.drawImage(desc as W2CDrawImage)
        return

      case 'CIRCLEIMAGE':
        await this.drawCircleImage(desc as W2CDrawCircleImage)
        return

      case 'TEXT':
        this.drawText(desc as W2CDrawText)
        return

      case 'CIRCLE':
        return this.drawCircle(desc as W2CDrawCircle)

      case 'RECT':
        this.drawRect(desc as W2CDrawRect)
        return

      case 'ROUNDRECT':
        this.drawRoundRect(desc as W2CDrawRoundRect)
        return
    }
  }

  /**
   * 绘制
   */
  public async draw(): Promise<void> {
    for (const wxmls of this.wxml2ds) {
      await Promise.all(
        wxmls.map((item) => {
          return this.drawWithTypeSelection(item)
        }),
      )
    }
    return
  }

  private async drawImage({ url, startX, startY, width, height }: W2CDrawImage): Promise<void> {
    const { path, width: originWidth, height: originHeight } = await this.getTempFileInfo(url)
    this.ctx.drawImage(path, startX, startY, width || originWidth, height || originHeight)
  }

  private async drawCircleImage({
    url,
    startX,
    startY,
    width,
    height,
    radius,
  }: W2CDrawCircleImage) {
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.arc(startX + width! / 2, startY + height! / 2, radius, 0, Math.PI * 2)
    this.ctx.clip()
    const { path, width: originWidth, height: originHeight } = await this.getTempFileInfo(url)
    this.ctx.drawImage(path, startX, startY, width || originWidth, height || originHeight)
    this.ctx.restore()
  }

  /**
   * 绘制文本
   */
  private drawText({
    text,
    startX,
    startY,
    font,
    align,
    fillColor,
    maxWidth,
    lineHeight,
  }: W2CDrawText): void {
    if (font) this.ctx.font = font
    if (align) this.ctx.setTextAlign(align)
    if (fillColor) this.ctx.setFillStyle(this.transformColor(fillColor))

    if (!maxWidth) {
      this.ctx.fillText(text, startX, startY)
      return
    }

    const allRow = Math.ceil(this.ctx.measureText(text).width / maxWidth)
    const count = allRow >= 1 ? 1 : allRow

    let endPos = 0
    for (let j = 0; j < count; j++) {
      const nowStr = text.slice(endPos)
      let rowWid = 0

      if (this.ctx.measureText(nowStr).width > maxWidth) {
        for (let m = 0; m < nowStr.length; m++) {
          rowWid += this.ctx.measureText(nowStr[m]).width
          if (rowWid > maxWidth) {
            if (j === 0) {
              this.ctx.fillText(`${nowStr.slice(0, m - 1)}...`, startX, startY)
            } else {
              this.ctx.fillText(nowStr.slice(0, m), startX, startY + lineHeight!)
            }
            endPos += m
            break
          }
        }
      } else {
        this.ctx.fillText(nowStr, startX, startY)
      }
    }
  }

  /**
   * 绘制圆形
   */
  private drawCircle({
    startX,
    startY,
    radius,
    fillColor,
    lineWidth,
    lineColor,
  }: W2CDrawCircle): void {
    this.ctx.beginPath()
    this.ctx.arc(startX, startY, radius, 0, Math.PI * 2)

    if (fillColor) {
      this.ctx.setFillStyle(this.transformColor(fillColor))
    }
    this.ctx.fill()

    if (lineWidth) {
      this.ctx.setLineWidth(lineWidth)
    }
    if (lineColor) {
      this.ctx.setStrokeStyle(this.transformColor(lineColor))
    }
    this.ctx.stroke()
  }

  /**
   * 绘制矩形
   */
  private drawRect({
    startX,
    startY,
    width,
    height,
    fillColor,
    lineWidth,
    lineColor,
  }: W2CDrawRect): void {
    // 开始绘制路径
    this.ctx.beginPath()

    // 绘制矩形路径 (简单的四条直线)
    this.ctx.rect(startX, startY, width, height)

    this.ctx.closePath()

    if (fillColor) {
      this.ctx.setFillStyle(this.transformColor(fillColor))
      this.ctx.fill()
    }

    if (lineWidth) {
      this.ctx.setLineWidth(lineWidth)
    }
    if (lineColor) {
      this.ctx.setStrokeStyle(this.transformColor(lineColor))
      this.ctx.stroke()
    }
  }

  /**
   * 绘制圆角矩形
   */
  private drawRoundRect({
    startX,
    startY,
    width,
    height,
    radius,
    fillColor,
    lineWidth,
    lineColor,
  }: W2CDrawRoundRect): void {
    this.ctx.beginPath()

    // 绘制左上角圆弧
    this.ctx.arc(startX + radius, startY + radius, radius, Math.PI, Math.PI * 1.5)
    // 绘制上边线
    this.ctx.lineTo(startX + width - radius, startY)

    // 绘制右上角圆弧
    this.ctx.arc(startX + width - radius, startY + radius, radius, Math.PI * 1.5, Math.PI * 2)
    // 绘制右边线
    this.ctx.lineTo(startX + width, startY + height - radius)

    // 绘制右下角圆弧
    this.ctx.arc(startX + width - radius, startY + height - radius, radius, 0, Math.PI * 0.5)
    // 绘制下边线
    this.ctx.lineTo(startX + radius, startY + height)

    // 绘制左下角圆弧
    this.ctx.arc(startX + radius, startY + height - radius, radius, Math.PI * 0.5, Math.PI)
    // 绘制左边线
    this.ctx.lineTo(startX, startY + radius)

    this.ctx.closePath()

    if (fillColor) {
      this.ctx.setFillStyle(this.transformColor(fillColor))
      this.ctx.fill()
    }

    if (lineWidth) {
      this.ctx.setLineWidth(lineWidth)
    }
    if (lineColor) {
      this.ctx.setStrokeStyle(this.transformColor(lineColor))
      this.ctx.stroke()
    }
  }

  /**
   * 将十六进制颜色转换为 rgba 格式
   * 支持 #rgb, #rgba, #rrggbb, #rrggbbaa 格式
   */
  private hexToRgba(hex: string): string {
    // 移除#号并转换为小写
    hex = hex.replace('#', '').toLowerCase()

    let r = 0,
      g = 0,
      b = 0,
      a = 1

    // 根据十六进制颜色长度处理不同情况
    if (hex.length === 3) {
      // #rgb 格式
      r = Number.parseInt(hex[0] + hex[0], 16)
      g = Number.parseInt(hex[1] + hex[1], 16)
      b = Number.parseInt(hex[2] + hex[2], 16)
    } else if (hex.length === 4) {
      // #rgba 格式
      r = Number.parseInt(hex[0] + hex[0], 16)
      g = Number.parseInt(hex[1] + hex[1], 16)
      b = Number.parseInt(hex[2] + hex[2], 16)
      a = Number.parseInt(hex[3] + hex[3], 16) / 255
    } else if (hex.length === 6) {
      // #rrggbb 格式
      r = Number.parseInt(hex.slice(0, 2), 16)
      g = Number.parseInt(hex.slice(2, 4), 16)
      b = Number.parseInt(hex.slice(4, 6), 16)
    } else if (hex.length === 8) {
      // #rrggbbaa 格式
      r = Number.parseInt(hex.slice(0, 2), 16)
      g = Number.parseInt(hex.slice(2, 4), 16)
      b = Number.parseInt(hex.slice(4, 6), 16)
      a = Number.parseInt(hex.slice(6, 8), 16) / 255
    } else {
      // 处理无效输入
      console.warn('Invalid hex color format:', hex)
    }

    // 确保RGB值在有效范围内
    r = Math.max(0, Math.min(255, r))
    g = Math.max(0, Math.min(255, g))
    b = Math.max(0, Math.min(255, b))

    // 确保透明度在有效范围内
    a = Math.max(0, Math.min(1, a))

    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  private transformColor(color: string): string {
    if (color.startsWith('#')) return this.hexToRgba(color)
    return color
  }

  /**
   * 按照 layer 分组元素，layer 越小越先绘制
   */
  private groupElementsByLayer<T extends { layer?: number }>(elements: T[]): T[][] {
    if (!elements.length) return []

    const sortedElements = [...elements].sort((a, b) => {
      const layerA = a.layer ?? 1
      const layerB = b.layer ?? 1
      return layerA - layerB
    })

    const result: T[][] = []
    let currentGroup: T[] = []
    let currentLayer: number | null = null

    for (const element of sortedElements) {
      const elementLayer = element.layer ?? 1
      if (currentLayer === null) {
        currentLayer = elementLayer
        currentGroup = [element]
      } else if (currentLayer === elementLayer) {
        currentGroup.push(element)
      } else {
        result.push(currentGroup)
        currentGroup = [element]
        currentLayer = elementLayer
      }
    }

    if (currentGroup.length > 0) {
      result.push(currentGroup)
    }

    return result
  }
  private getTempFileInfo(
    url: string,
    // @ts-ignore
  ): Promise<UniApp.GetImageInfoSuccessData> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      uni.getImageInfo({
        src: url,
        success: (res: Record<'path', string> & Record<'width' | 'height', number>) => {
          resolve(res)
        },
        fail: (error: any) => {
          reject(error)
        },
      })
    })
  }
}
