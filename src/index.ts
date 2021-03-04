import * as PIXI from "pixi.js";
import InteractionEvents from "./InteractionEvents";
import {
  TagBrackets,
  TagStyle,
  bbcodePropertyRegex,
  propertyRegex,
} from "./tags";
import {
  TextStyleExtended,
  TextStyleExtendedWithDefault,
  TextStyleSet,
  TextStyleSetWithDefault,
  MstDebugOptions,
  MstInteractionEvent,
  HitboxData,
  TextData,
  TagData,
  TextDrawingData,
  TextWithPrivateMembers,
} from "./types";

import { splitIntoLines, tokenize } from "./textUtils";
import { checkPixiVersion, getFontString, measureTextWidth } from "./pixiUtils";

("use strict");
checkPixiVersion(PIXI.VERSION, 5);

const WHITESPACE_REGEXP = /(\s\n\s)|(\s\n)|(\n\s)/g;

const presetStyles: TextStyleSet = {
  b: { fontStyle: "bold" },
  i: { fontStyle: "italic" },
  color: { fill: "" }, // an array would result in gradient
  outline: { stroke: "", strokeThickness: 6 },
  font: { fontFamily: "" },
  shadow: {
    dropShadowColor: "",
    dropShadow: true,
    dropShadowBlur: 3,
    dropShadowDistance: 3,
    dropShadowAngle: 2,
  },
  size: { fontSize: "px" },
  spacing: { letterSpacing: 0 },
  align: { align: "" },
};

export default class MultiStyleText extends PIXI.Text {
  private static DEFAULT_TagStyle: TextStyleExtendedWithDefault = {
    align: "left",
    breakWords: false,
    dropShadow: false,
    dropShadowAngle: Math.PI / 6,
    dropShadowBlur: 0,
    dropShadowColor: "#000000",
    dropShadowDistance: 5,
    fill: "black",
    fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
    fontFamily: "Arial",
    fontSize: 26,
    fontStyle: "normal",
    fontVariant: "normal",
    fontWeight: "normal",
    letterSpacing: 0,
    lineHeight: 0,
    lineSpacing: 0,
    lineJoin: "miter",
    miterLimit: 10,
    padding: 0,
    stroke: "black",
    strokeThickness: 0,
    textBaseline: "alphabetic",
    wordWrap: false,
    wordWrapWidth: 100,

    tagStyle: "xml",
    debug: false,
    valign: "baseline",
  };

  public static debugOptions: MstDebugOptions = {
    spans: {
      enabled: false,
      baseline: "#44BB44",
      top: "#BB4444",
      bottom: "#4444BB",
      bounding: "rgba(255, 255, 255, 0.1)",
      text: true,
    },
    objects: {
      enabled: false,
      bounding: "rgba(255, 255, 255, 0.05)",
      text: true,
    },
  };

  private _textStyles!: TextStyleSetWithDefault;

  public get textStyles(): TextStyleSetWithDefault {
    return this._textStyles;
  }

  public set textStyles(_: TextStyleSetWithDefault) {
    throw new Error("Don't set textStyles directly. Use setStyles()");
  }

  public get defaultTextStyle(): TextStyleExtendedWithDefault {
    return this.textStyles.default;
  }
  public set defaultTextStyle(style: TextStyleExtendedWithDefault) {
    this.textStyles.default = style;
  }

  private resetTextStyles() {
    this._textStyles = { default: { ...MultiStyleText.DEFAULT_TagStyle } };
  }
  private resetDefaultStyle() {
    this.defaultTextStyle = { ...MultiStyleText.DEFAULT_TagStyle };
  }

  public setStyles(styles: TextStyleSetWithDefault): void {
    this.resetTextStyles();

    this.setTagStyles(styles);

    // todo: Should we make this work for html style tags too? Why just for BBCode?
    // todo: original code had these overwriting the styles you just set. Is that on purpose?
    if (this.textStyles.default.tagStyle === TagStyle.bbcode) {
      // when using bbcode parsing, register a bunch of standard bbcode tags and some cool pixi ones
      this.setTagStyles(presetStyles, true);
    }
  }

  private setDirty(dirty = true) {
    this.withPrivateMembers().dirty = dirty;
  }

  private setRootDefaultStyle(style: TextStyleExtended) {
    this.withPrivateMembers()._style = new PIXI.TextStyle(style);
  }

  private updateRootDefaultStyle() {
    this.setRootDefaultStyle(this.defaultTextStyle);
  }

  private hitboxes: HitboxData[] = [];
  private resetHitboxes() {
    this.hitboxes = [];
  }

  /////
  /// CONSTRUCTOR
  /////

  constructor(text: string, styles: TextStyleSetWithDefault) {
    super(text);

    this.setStyles(styles);

    this.initEvents();
  }

  ///////////
  ///////////

  private initEvents() {
    const migrateEvent = (e: PIXI.InteractionEvent) =>
      this.handleInteraction(e);

    InteractionEvents.forEach((event) => {
      this.on(event, migrateEvent);
    });
  }

  private handleInteraction(e: PIXI.InteractionEvent) {
    const ev = e as MstInteractionEvent;

    const localPoint = e.data.getLocalPosition(this);
    const targetTag = this.hitboxes.reduce(
      (prev: HitboxData | undefined, hitbox: HitboxData) => {
        if (prev !== undefined) {
          return prev;
        }
        if (hitbox.hitbox.contains(localPoint.x, localPoint.y)) {
          return hitbox;
        }
        return undefined;
      },
      undefined
    );
    ev.targetTag = targetTag === undefined ? undefined : targetTag.tag;
  }

  /////

  public setTagStyle(
    tagName: string,
    style: TextStyleExtended,
    overwrite = false
  ): void {
    // if the tag name is "default", merge it and update underlying
    if (tagName === "default") {
      this.defaultTextStyle = { ...this.defaultTextStyle, ...style };
      this.updateRootDefaultStyle();
    } else {
      let previousStyle = {};
      if (tagName in this.textStyles && overwrite === false) {
        previousStyle = this.textStyles[tagName];
      }
      this.textStyles[tagName] = { ...previousStyle, ...style };
    }
    this.setDirty(true);
  }

  public setTagStyles(styles: TextStyleSet, overwrite = false): void {
    for (const styleName in styles) {
      this.setTagStyle(styleName, styles[styleName], overwrite);
    }
  }

  public deleteTagStyle(tagName: string): void {
    if (tagName === "default") {
      this.defaultTextStyle = { ...MultiStyleText.DEFAULT_TagStyle };
      this.updateRootDefaultStyle();
    } else {
      delete this.textStyles[tagName];
    }
  }

  /////

  private getTagRegex(captureName: boolean, captureMatch: boolean): RegExp {
    let tagAlternation = Object.keys(this.textStyles).join("|");
    const { tagStyle } = this.defaultTextStyle;

    if (captureName) {
      tagAlternation = `(${tagAlternation})`;
    } else {
      tagAlternation = `(?:${tagAlternation})`;
    }

    let pattern;
    if (tagStyle === TagStyle.bbcode) {
      const [openTag, closeTag] = TagBrackets.bbcode;
      pattern = `\\${openTag}${tagAlternation}(?:\\=(?:[A-Za-z0-9_\\-\\#]+|'(?:[^']+|\\\\')*'))*\\s*\\${closeTag}|\\${openTag}\\/${tagAlternation}\\s*\\${closeTag}`;
    } else {
      const [openTag, closeTag] = TagBrackets.xml;
      pattern = `\\${openTag}${tagAlternation}(?:\\s+[A-Za-z0-9_\\-]+=(?:"(?:[^"]+|\\\\")*"|'(?:[^']+|\\\\')*'))*\\s*\\${closeTag}|\\${openTag}\\/${tagAlternation}\\s*\\${closeTag}`;
    }

    if (captureMatch) {
      pattern = `(${pattern})`;
    }

    return new RegExp(pattern, "g");
  }

  private getTextDataPerLine(stringLines: string[]) {
    const lines: TextData[][] = [];
    const re = this.getTagRegex(true, false);

    const styleStack = [{ ...this.defaultTextStyle }];
    const tagStack: TagData[] = [{ name: "default", properties: {} }];

    // determine the group of word for each line
    for (let lineIndex = 0; lineIndex < stringLines.length; lineIndex++) {
      const stringLine = stringLines[lineIndex];
      const line: TextData[] = [];

      // find tags inside the string
      const matches: RegExpExecArray[] = [];
      let matchArray: RegExpExecArray | null;

      while ((matchArray = re.exec(stringLine))) {
        matches.push(matchArray);
      }

      // if there is no match, we still need to add the line with the default style
      if (matches.length === 0) {
        line.push(
          createTextData(
            stringLines[lineIndex],
            styleStack[styleStack.length - 1],
            tagStack[tagStack.length - 1]
          )
        );
      } else {
        // We got a match! add the text with the needed style
        let currentSearchIdx = 0;
        for (let j = 0; j < matches.length; j++) {
          // if index > 0, it means we have characters before the match,
          // so we need to add it with the default style
          if (matches[j].index > currentSearchIdx) {
            line.push(
              createTextData(
                stringLines[lineIndex].substring(
                  currentSearchIdx,
                  matches[j].index
                ),
                styleStack[styleStack.length - 1],
                tagStack[tagStack.length - 1]
              )
            );
          }

          if (matches[j][0][1] === "/") {
            // reset the style if end of tag
            if (styleStack.length > 1) {
              styleStack.pop();
              tagStack.pop();
            }
          } else {
            // set the current style
            const properties: { [key: string]: string } = {};
            let propertyMatch: RegExpMatchArray | null;

            while ((propertyMatch = propertyRegex.exec(matches[j][0]))) {
              properties[propertyMatch[1]] =
                propertyMatch[2] || propertyMatch[3];
            }

            tagStack.push({ name: matches[j][1], properties });

            const { tagStyle } = this.defaultTextStyle;
            // if using bbtag style, take styling information in a different way
            if (
              tagStyle === TagStyle.bbcode &&
              matches[j][0].includes("=") &&
              this.textStyles[matches[j][1]]
            ) {
              const bbcodeTags = bbcodePropertyRegex.exec(matches[j][0]);
              const bbStyle: { [key: string]: string | number } = {};

              const textStylesAsArray = Object.entries(
                this.textStyles[matches[j][1]]
              );
              textStylesAsArray.forEach(([styleName, styleRules]) => {
                if (typeof styleRules === "string" && bbcodeTags !== null) {
                  bbStyle[styleName] = bbcodeTags[1] + styleRules;
                } else if (
                  typeof styleRules === "number" &&
                  bbcodeTags !== null
                ) {
                  bbStyle[styleName] = Number(bbcodeTags[1]) || styleRules;
                } else {
                  bbStyle[styleName] = styleRules;
                }
              });

              styleStack.push({
                ...styleStack[styleStack.length - 1],
                ...bbStyle,
              });
            } else {
              styleStack.push({
                ...styleStack[styleStack.length - 1],
                ...this.textStyles[matches[j][1]],
              });
            }
          }

          // update the current search index
          currentSearchIdx = matches[j].index + matches[j][0].length;
        }

        // is there any character left?
        if (currentSearchIdx < stringLines[lineIndex].length) {
          const result = createTextData(
            currentSearchIdx
              ? stringLines[lineIndex].substring(currentSearchIdx)
              : stringLines[lineIndex],
            styleStack[styleStack.length - 1],
            tagStack[tagStack.length - 1]
          );
          line.push(result);
        }
      }

      lines.push(line);
    }

    // don't display any incomplete tags at the end of text- good for scrolling text in games
    const { tagStyle } = this.defaultTextStyle;
    lines[lines.length - 1].map((data) => {
      if (data.text.includes(TagBrackets[tagStyle][0])) {
        let pattern;
        if (tagStyle === TagStyle.bbcode) {
          pattern = /^(.*)\[/;
        } else {
          pattern = /^(.*)</;
        }
        const matches = data.text.match(pattern);
        if (matches) {
          data.text = matches[1];
        }
      }
    });

    return lines;

    // internal functions
    function createTextData(
      text: string,
      style: TextStyleExtended,
      tag: TagData
    ): TextData {
      return {
        text,
        style,
        width: 0,
        height: 0,
        fontProperties: { ascent: 0, descent: 0, fontSize: 0 },
        tag,
      };
    }
  }

  private getDropShadowPadding(): number {
    let maxDistance = 0;
    let maxBlur = 0;

    Object.keys(this.textStyles).forEach((styleKey) => {
      const { dropShadowDistance, dropShadowBlur } = this.textStyles[styleKey];
      maxDistance = Math.max(maxDistance, dropShadowDistance || 0);
      maxBlur = Math.max(maxBlur, dropShadowBlur || 0);
    });

    return maxDistance + maxBlur;
  }

  private withPrivateMembers(): TextWithPrivateMembers {
    return (this as unknown) as TextWithPrivateMembers;
  }

  public updateText(): void {
    if (!this.withPrivateMembers().dirty) {
      return;
    }

    this.resetHitboxes();

    this.texture.baseTexture.resolution = this.resolution;
    const textStyles = this.textStyles;
    let outputText = this.text;

    if (this.withPrivateMembers()._style.wordWrap) {
      outputText = this.calculateWordWrap(this.text);
    }

    // split text into lines
    const lines = splitIntoLines(outputText);

    // get the text data with specific styles
    const outputTextData = this.getTextDataPerLine(lines);

    // calculate text width and height
    const lineWidths: number[] = [];
    const lineYMins: number[] = [];
    const lineYMaxs: number[] = [];
    let maxLineWidth = 0;
    const lineSpacing = textStyles["default"].lineSpacing;

    for (let i = 0; i < lines.length; i++) {
      let lineWidth = 0;
      let lineYMin = 0;
      let lineYMax = 0;

      for (let j = 0; j < outputTextData[i].length; j++) {
        const sty = outputTextData[i][j].style;
        const ls = sty.letterSpacing || 0;

        this.context.font = getFontString(sty);

        // save the width
        outputTextData[i][j].width = measureTextWidth(
          this.context,
          outputTextData[i][j].text
        );

        if (outputTextData[i][j].text.length !== 0) {
          outputTextData[i][j].width +=
            (outputTextData[i][j].text.length - 1) * ls;

          if (j > 0) {
            lineWidth += ls / 2; // spacing before first character
          }

          if (j < outputTextData[i].length - 1) {
            lineWidth += ls / 2; // spacing after last character
          }
        }

        lineWidth += outputTextData[i][j].width;

        // save the font properties
        outputTextData[i][j].fontProperties = PIXI.TextMetrics.measureFont(
          this.context.font
        );

        // save the height
        outputTextData[i][j].height =
          outputTextData[i][j].fontProperties.fontSize;

        if (typeof sty.valign === "number") {
          lineYMin = Math.min(
            lineYMin,
            sty.valign - outputTextData[i][j].fontProperties.descent
          );
          lineYMax = Math.max(
            lineYMax,
            sty.valign + outputTextData[i][j].fontProperties.ascent
          );
        } else {
          lineYMin = Math.min(
            lineYMin,
            -outputTextData[i][j].fontProperties.descent
          );
          lineYMax = Math.max(
            lineYMax,
            outputTextData[i][j].fontProperties.ascent
          );
        }
      }

      lineWidths[i] = lineWidth;
      lineYMins[i] = lineYMin;
      lineYMaxs[i] = lineYMax;

      if (i > 0 && lineSpacing) {
        lineYMaxs[i] += lineSpacing;
      }

      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    }

    // transform styles in array
    const stylesArray = Object.keys(textStyles).map((key) => textStyles[key]);

    const maxStrokeThickness = stylesArray.reduce(
      (prev, cur) => Math.max(prev, cur.strokeThickness || 0),
      0
    );

    const dropShadowPadding = this.getDropShadowPadding();

    const totalHeight =
      lineYMaxs.reduce((prev, cur) => prev + cur, 0) -
      lineYMins.reduce((prev, cur) => prev + cur, 0);

    // define the right width and height
    const width = maxLineWidth + 2 * maxStrokeThickness + 2 * dropShadowPadding;
    const height = totalHeight + 2 * maxStrokeThickness + 2 * dropShadowPadding;

    this.canvas.width = width * this.resolution;
    this.canvas.height = height * this.resolution;

    this.context.scale(this.resolution, this.resolution);

    this.context.textBaseline = "alphabetic";
    this.context.lineJoin = "round";

    let basePositionY = dropShadowPadding + maxStrokeThickness;

    const drawingData: TextDrawingData[] = [];

    // Compute the drawing data
    for (let i = 0; i < outputTextData.length; i++) {
      const line = outputTextData[i];
      let linePositionX: number;

      switch (this.withPrivateMembers()._style.align) {
        case "center":
          linePositionX =
            dropShadowPadding +
            maxStrokeThickness +
            (maxLineWidth - lineWidths[i]) / 2;
          break;
        case "right":
          linePositionX =
            dropShadowPadding +
            maxStrokeThickness +
            maxLineWidth -
            lineWidths[i];
          break;
        case "left":
        default:
          linePositionX = dropShadowPadding + maxStrokeThickness;
          break;
      }

      for (let j = 0; j < line.length; j++) {
        const { style, text, fontProperties, width, tag } = line[j];
        const ls = style.letterSpacing || 0;

        let linePositionY = basePositionY + fontProperties.ascent;

        switch (style.valign) {
          case "top":
            // no need to do anything
            break;

          case "baseline":
            linePositionY += lineYMaxs[i] - fontProperties.ascent;
            break;

          case "middle":
            linePositionY +=
              (lineYMaxs[i] -
                lineYMins[i] -
                fontProperties.ascent -
                fontProperties.descent) /
              2;
            break;

          case "bottom":
            linePositionY +=
              lineYMaxs[i] -
              lineYMins[i] -
              fontProperties.ascent -
              fontProperties.descent;
            break;

          default:
            // A number - offset from baseline, positive is higher
            linePositionY +=
              lineYMaxs[i] - fontProperties.ascent - (style.valign || 0);
            break;
        }

        if (ls === 0) {
          drawingData.push({
            text,
            style,
            x: linePositionX,
            y: linePositionY,
            width,
            ascent: fontProperties.ascent,
            descent: fontProperties.descent,
            tag,
          });

          linePositionX += line[j].width;
        } else {
          this.context.font = getFontString(line[j].style);

          for (let k = 0; k < text.length; k++) {
            if (k > 0 || j > 0) {
              linePositionX += ls / 2;
            }

            const charWidth = measureTextWidth(this.context, text.charAt(k));

            drawingData.push({
              text: text.charAt(k),
              style,
              x: linePositionX,
              y: linePositionY,
              width: charWidth,
              ascent: fontProperties.ascent,
              descent: fontProperties.descent,
              tag,
            });

            linePositionX += charWidth;

            if (k < text.length - 1 || j < line.length - 1) {
              linePositionX += ls / 2;
            }
          }
        }
      }

      basePositionY += lineYMaxs[i] - lineYMins[i];
    }

    this.context.save();

    // First pass: draw the shadows only
    drawingData.forEach(({ style, text, x, y }) => {
      if (!style.dropShadow) {
        return; // This text doesn't have a shadow
      }

      this.context.font = getFontString(style);

      let dropFillStyle = style.dropShadowColor || 0;
      if (typeof dropFillStyle === "number") {
        dropFillStyle = PIXI.utils.hex2string(dropFillStyle);
      }
      const blur = style.dropShadowBlur || 0;
      const angle = style.dropShadowAngle || 0;
      const distance = style.dropShadowDistance || 0;
      this.context.shadowColor = dropFillStyle;
      this.context.shadowBlur = blur;
      this.context.shadowOffsetX = Math.cos(angle) * distance * this.resolution;
      this.context.shadowOffsetY = Math.sin(angle) * distance * this.resolution;

      this.context.fillText(text, x, y);
    });

    this.context.restore();

    // Second pass: draw the strokes only
    drawingData.forEach(({ style, text, x, y }) => {
      if (style.stroke === undefined || !style.strokeThickness) {
        return; // Skip this step if we have no stroke
      }

      this.context.font = getFontString(style);

      let strokeStyle = style.stroke;
      if (typeof strokeStyle === "number") {
        strokeStyle = PIXI.utils.hex2string(strokeStyle);
      }

      this.context.strokeStyle = strokeStyle;
      this.context.lineWidth = style.strokeThickness;

      this.context.strokeText(text, x, y);
    });

    // Third pass: draw the fills only
    drawingData.forEach(({ style, text, x, y }) => {
      if (style.fill === undefined) {
        return; // Skip this step if we have no fill
      }

      this.context.font = getFontString(style);

      // set canvas text styles
      let fillStyle = style.fill;
      if (typeof fillStyle === "number") {
        fillStyle = PIXI.utils.hex2string(fillStyle);
      } else if (Array.isArray(fillStyle)) {
        for (let i = 0; i < fillStyle.length; i++) {
          const fill = fillStyle[i];
          if (typeof fill === "number") {
            fillStyle[i] = PIXI.utils.hex2string(fill);
          }
        }
      }
      this.context.fillStyle = ((this as unknown) as TextWithPrivateMembers)._generateFillStyle(
        new PIXI.TextStyle(style),
        [text]
      ) as string | CanvasGradient;
      // Typecast required for proper typechecking

      this.context.fillText(text, x, y);
    });

    // Fourth pass: collect the bounding boxes and draw the debug information
    drawingData.forEach(({ style, x, y, width, ascent, descent, tag }) => {
      const offset =
        -this.withPrivateMembers()._style.padding - this.getDropShadowPadding();

      this.hitboxes.push({
        tag,
        hitbox: new PIXI.Rectangle(
          x + offset,
          y - ascent + offset,
          width,
          ascent + descent
        ),
      });

      const debugSpan =
        style.debug === undefined
          ? MultiStyleText.debugOptions.spans.enabled
          : style.debug;

      if (debugSpan) {
        this.context.lineWidth = 1;

        if (MultiStyleText.debugOptions.spans.bounding) {
          this.context.fillStyle = MultiStyleText.debugOptions.spans.bounding;
          this.context.strokeStyle = MultiStyleText.debugOptions.spans.bounding;
          this.context.beginPath();
          this.context.rect(x, y - ascent, width, ascent + descent);
          this.context.fill();
          this.context.stroke();
          this.context.stroke(); // yes, twice
        }

        if (MultiStyleText.debugOptions.spans.baseline) {
          this.context.strokeStyle = MultiStyleText.debugOptions.spans.baseline;
          this.context.beginPath();
          this.context.moveTo(x, y);
          this.context.lineTo(x + width, y);
          this.context.closePath();
          this.context.stroke();
        }

        if (MultiStyleText.debugOptions.spans.top) {
          this.context.strokeStyle = MultiStyleText.debugOptions.spans.top;
          this.context.beginPath();
          this.context.moveTo(x, y - ascent);
          this.context.lineTo(x + width, y - ascent);
          this.context.closePath();
          this.context.stroke();
        }

        if (MultiStyleText.debugOptions.spans.bottom) {
          this.context.strokeStyle = MultiStyleText.debugOptions.spans.bottom;
          this.context.beginPath();
          this.context.moveTo(x, y + descent);
          this.context.lineTo(x + width, y + descent);
          this.context.closePath();
          this.context.stroke();
        }

        if (MultiStyleText.debugOptions.spans.text) {
          this.context.fillStyle = "#ffffff";
          this.context.strokeStyle = "#000000";
          this.context.lineWidth = 2;
          this.context.font = "8px monospace";
          this.context.strokeText(tag.name, x, y - ascent + 8);
          this.context.fillText(tag.name, x, y - ascent + 8);
          this.context.strokeText(
            `${width.toFixed(2)}x${(ascent + descent).toFixed(2)}`,
            x,
            y - ascent + 16
          );
          this.context.fillText(
            `${width.toFixed(2)}x${(ascent + descent).toFixed(2)}`,
            x,
            y - ascent + 16
          );
        }
      }
    });

    if (MultiStyleText.debugOptions.objects.enabled) {
      if (MultiStyleText.debugOptions.objects.bounding) {
        this.context.fillStyle = MultiStyleText.debugOptions.objects.bounding;
        this.context.beginPath();
        this.context.rect(0, 0, width, height);
        this.context.fill();
      }

      if (MultiStyleText.debugOptions.objects.text) {
        this.context.fillStyle = "#ffffff";
        this.context.strokeStyle = "#000000";
        this.context.lineWidth = 2;
        this.context.font = "8px monospace";
        this.context.strokeText(
          `${width.toFixed(2)}x${height.toFixed(2)}`,
          0,
          8,
          width
        );
        this.context.fillText(
          `${width.toFixed(2)}x${height.toFixed(2)}`,
          0,
          8,
          width
        );
      }
    }

    this.updateTexture();
  }

  protected calculateWordWrap(text: string): string {
    // Greedy wrapping algorithm that will wrap words as the line grows longer than its horizontal bounds.
    let result = "";
    const re = this.getTagRegex(true, true);
    const thisPrivate = this.withPrivateMembers();
    const style = thisPrivate._style;

    const lines = text.split("\n");
    const { wordWrapWidth, letterSpacing } = style;

    const styleStack = [{ ...this.defaultTextStyle }];
    this.context.font = getFontString(this.textStyles["default"]);

    for (let i = 0; i < lines.length; i++) {
      let spaceLeft = wordWrapWidth;
      const tagSplit = lines[i].split(re);
      let firstWordOfLine = true;

      for (let j = 0; j < tagSplit.length; j++) {
        if (re.test(tagSplit[j])) {
          result += tagSplit[j];
          if (tagSplit[j][1] === "/") {
            j += 2;
            styleStack.pop();
          } else {
            j++;
            styleStack.push({
              ...styleStack[styleStack.length - 1],
              ...this.textStyles[tagSplit[j]],
            });
            j++;
          }
          this.context.font = getFontString(styleStack[styleStack.length - 1]);
        } else {
          const words = tokenize(tagSplit[j]);

          for (let k = 0; k < words.length; k++) {
            let cw = 0;
            if (letterSpacing > 0) {
              const chars = words[k].split("");
              for (let c = 0; c < chars.length; c++) {
                cw += measureTextWidth(this.context, chars[c]) + letterSpacing;
              }
            } else {
              cw = measureTextWidth(this.context, words[k]);
            }
            const wordWidth = cw;

            if (style.breakWords && wordWidth > spaceLeft) {
              // Part should be split in the middle
              const characters = words[k].split("");

              for (let c = 0; c < characters.length; c++) {
                const characterWidth =
                  measureTextWidth(this.context, characters[c]) + letterSpacing;

                if (characterWidth > spaceLeft) {
                  result += `\n${characters[c]}`;
                  spaceLeft = wordWrapWidth - characterWidth;
                } else {
                  result += characters[c];
                  spaceLeft -= characterWidth;
                }
              }
            } else if (style.breakWords) {
              result += words[k];
              spaceLeft -= wordWidth;
            } else {
              const paddedWordWidth = wordWidth + letterSpacing;

              if (paddedWordWidth > spaceLeft) {
                // Skip printing the newline if it's the first word of the line that is
                // greater than the word wrap width.
                if (!firstWordOfLine) {
                  result += "\n";
                }

                result += words[k];
                spaceLeft = wordWrapWidth - wordWidth;
              } else {
                spaceLeft -= paddedWordWidth;
                result += words[k];
              }
            }
            firstWordOfLine = false;
          }
        }
      }

      if (i < lines.length - 1) {
        result += "\n";
      }
    }

    result = result.replace(WHITESPACE_REGEXP, "\n");
    return result;
  }

  protected updateTexture(): void {
    const thisRoot = this.withPrivateMembers();
    const { _texture: texture, _style: style } = thisRoot;
    const { padding: PADDING } = style;
    const DROP_SHADOW_PADDING = this.getDropShadowPadding();
    const { canvas, resolution: RESOLUTION } = this;
    const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = canvas;
    const TRIM = PADDING + DROP_SHADOW_PADDING;

    texture.baseTexture.setRealSize(CANVAS_WIDTH, CANVAS_HEIGHT, RESOLUTION);
    texture.trim.width = texture.frame.width = CANVAS_WIDTH / RESOLUTION;
    texture.trim.height = texture.frame.height = CANVAS_HEIGHT / RESOLUTION;

    texture.trim.x = -TRIM;
    texture.trim.y = -TRIM;

    texture.orig.width = texture.frame.width - TRIM * 2;
    texture.orig.height = texture.frame.height - TRIM * 2;

    // call sprite onTextureUpdate to update scale if _width or _height were set
    thisRoot._onTextureUpdate();

    texture.baseTexture.emit("update", texture.baseTexture);

    this.setDirty(false);
  }
}
