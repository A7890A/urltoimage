//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript - TypeScript Declaration File
//
// Copyright (c) 2016 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

declare module "qrcode-generator-es6" {
  export default class qrcode {
    constructor(typeNumber: number, errorCorrectionLevel: string);
    addData(data: any, mode?: string);
    getModuleCount(): number;
    make();
    isDark(row: number, col: number): boolean;
    createImgTag(cellSize?: number, margin?: number): string;
    createSvgTag({
      drawCell,
      cellColor,
      cellSize,
      margin,
      bg,
      obstruction
    }: {
      drawCell?: (c: number, r: number, x: number, y: number) => string;
      cellColor: (c: number, r: number) => string;
      cellSize?: number;
      margin?: number;
      bg?: {
        enabled: boolean;
        fill?: string;
      };
      obstruction?: {
        path?: string;
        svgData?: string;
        width: number;
        height: number;
      };
    }): string;
    createTableTag(cellSize?: number, margin?: number): string;
  }
}
