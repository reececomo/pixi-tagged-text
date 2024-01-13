import * as PIXI from "pixi.js";
import TaggedText from "./TaggedText";
export type Point = {
    x: number;
    y: number;
};
export type Rectangle = Point & {
    width: number;
    height: number;
};
export type Bounds = Rectangle;
export type Nested<T> = T | Array<Nested<T>>;
export type SpriteSource = string | PIXI.Texture | HTMLCanvasElement | HTMLVideoElement;
export type TextureSource = string | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | PIXI.BaseTexture;
export type ImageSource = PIXI.Sprite | SpriteSource | TextureSource;
export declare const isSpriteSource: (s: ImageSource) => s is SpriteSource;
export declare const isBaseTexture: (s: ImageSource) => s is PIXI.BaseTexture<PIXI.Resource, PIXI.IAutoDetectOptions>;
export declare const isImageElement: (s: ImageSource) => s is HTMLImageElement;
export declare const isTextureSource: (s: ImageSource) => s is TextureSource;
export type FontProperty = string | number;
export type FontMap = Record<string, FontProperty>;
export type ImageSourceMap = Record<string, ImageSource>;
export type ImageMap = Record<string, PIXI.Sprite>;
export type SplitStyle = "words" | "characters";
export type ErrorMessageType = "warning" | "error";
export interface ErrorMessage {
    type: ErrorMessageType;
    code: string;
    message: string;
    target?: TaggedText;
}
export type ErrorHandler = (e: ErrorMessage) => void;
export interface IFontMetrics {
    ascent: number;
    descent: number;
    fontSize: number;
}
export interface TaggedTextOptions {
    debug?: boolean;
    debugConsole?: boolean;
    splitStyle?: SplitStyle;
    adjustFontBaseline?: FontMap;
    imgMap?: ImageSourceMap;
    scaleIcons?: boolean;
    skipUpdates?: boolean;
    skipDraw?: boolean;
    drawWhitespace?: boolean;
    wrapEmoji?: boolean;
    errorHandler?: ErrorHandler;
    supressConsole?: boolean;
    overdrawDecorations?: number;
}
export declare const IMG_REFERENCE_PROPERTY = "imgSrc";
export declare const IMG_DISPLAY_PROPERTY = "imgDisplay";
export declare const DEFAULT_KEY = "default";
export declare enum MeasurementUnit {
    default = "px",
    px = "px",
    em = "em",
    rem = "rem",
    pt = "pt",
    pc = "pc",
    in = "in",
    cm = "cm",
    mm = "mm",
    percent = "%",
    unknown = "unknown"
}
export declare const DEFAULT_MEASUREMENT_UNIT: MeasurementUnit;
export interface MeasurementComponents {
    value: number;
    unit: MeasurementUnit;
}
export type MeasurementValue = string | number;
export type Thickness = number;
export type Color = string | number;
export type FontSize = MeasurementValue;
export type Fill = Color | string[] | number[] | CanvasGradient | CanvasPattern;
export type VAlign = "top" | "middle" | "bottom" | "baseline" | number;
export type AlignClassic = "left" | "right" | "center" | "justify";
export type Align = AlignClassic | "justify" | "justify-left" | "justify-right" | "justify-center" | "justify-all";
export type ImageDisplayMode = "icon" | "block" | "inline";
export type ImageReference = string;
export type ImageDimensionPercentage = string;
export type ImageDimension = number | string | ImageDimensionPercentage;
export type TextTransform = "normal" | "capitalize" | "uppercase" | "lowercase";
export type FontStyle = "normal" | "italic" | "oblique";
export type TextDecorationValue = "underline" | "overline" | "line-through";
export type TextDecoration = "normal" | TextDecorationValue | `${TextDecorationValue} ${TextDecorationValue}` | `${TextDecorationValue} ${TextDecorationValue} ${TextDecorationValue}`;
export interface ImageStyles {
    [IMG_REFERENCE_PROPERTY]?: ImageReference;
    [IMG_DISPLAY_PROPERTY]?: ImageDisplayMode;
    imgScale?: ImageDimensionPercentage;
    imgScaleX?: ImageDimensionPercentage;
    imgScaleY?: ImageDimensionPercentage;
    imgWidth?: ImageDimension;
    imgHeight?: ImageDimension;
    iconScale?: number;
}
export interface UnderlineStyle {
    underlineColor?: Color;
    underlineThickness?: Thickness;
    underlineOffset?: number;
}
export interface OverlineStyle {
    overlineColor?: Color;
    overlineThickness?: Thickness;
    overlineOffset?: number;
}
export interface LineThroughStyle {
    lineThroughColor?: Color;
    lineThroughThickness?: Thickness;
    lineThroughOffset?: number;
}
export interface TextDecorationStyles extends UnderlineStyle, OverlineStyle, LineThroughStyle {
    textDecoration?: TextDecoration;
}
export interface VerticalAlignStyles {
    valign?: VAlign;
}
export interface VerticalSpacingStyles {
    lineSpacing?: number;
    paragraphSpacing?: number;
    adjustBaseline?: number;
}
export interface FontScaleStyles {
    fontScaleWidth?: number;
    fontScaleHeight?: number;
}
export interface TextTransformStyles {
    textTransform?: TextTransform;
}
export interface LineBreakStyles {
    breakLines?: boolean;
}
export interface TextStyleExtended extends Record<string, unknown>, Partial<Omit<PIXI.ITextStyle, "align">>, ImageStyles, TextDecorationStyles, VerticalAlignStyles, VerticalSpacingStyles, FontScaleStyles, TextTransformStyles, LineBreakStyles {
    align?: Align;
    fontStyle?: FontStyle;
    fontSize?: FontSize;
    color?: PIXI.TextStyleFill;
}
export interface TextDecorationMetrics {
    color: Color;
    bounds: Bounds;
}
export type TextStyleSet = Record<string, TextStyleExtended>;
type TagName = string;
type AttributeName = string;
type AttributeValue = string | number;
export type AttributesList = Record<AttributeName, AttributeValue>;
export interface TagWithAttributes {
    tagName: string;
    attributes: AttributesList;
}
export interface TagMatchData extends TagWithAttributes {
    tag: string;
    isOpening: boolean;
    index: number;
}
export type TagStack = TagMatchData[];
export type NewlineToken = "\n";
export type WhitespaceToken = " " | "\t" | NewlineToken;
export type TextToken = string;
export type SpriteToken = PIXI.Sprite;
export interface CompositeToken<T extends Token = Token> {
    children: T[];
}
export type Token = TextToken | CompositeToken | SpriteToken;
export type Tokens = CompositeToken;
export interface TagToken extends CompositeToken<TagToken | TextToken> {
    tag?: TagName;
    attributes?: AttributesList;
}
export type TagTokens = TagToken;
export interface StyledToken extends CompositeToken<StyledToken | TextToken | SpriteToken> {
    style: TextStyleExtended;
    tags: string;
}
export type StyledTokens = StyledToken;
export type SegmentContent = TextToken | SpriteToken;
export interface SegmentToken {
    content: SegmentContent;
    bounds: Rectangle;
    fontProperties: IFontMetrics;
    style: TextStyleExtended;
    tags: string;
    textDecorations?: TextDecorationMetrics[];
}
export type WordToken = SegmentToken[];
export type LineToken = WordToken[];
export type ParagraphToken = LineToken[];
export declare const createEmptySegmentToken: () => SegmentToken;
export interface SpriteSegmentToken extends SegmentToken {
    content: SpriteToken;
}
export interface TextSegmentToken extends SegmentToken {
    content: TextToken;
}
export interface WhitespaceSegmentToken extends TextSegmentToken {
    content: WhitespaceToken;
}
export interface NewlineSegmentToken extends TextSegmentToken {
    content: NewlineToken;
}
export declare const isWhitespace: (s: string) => s is WhitespaceToken;
export declare const isNewline: (s: string) => s is "\n";
export declare const _isSpriteToken: (t: SegmentToken) => t is SpriteSegmentToken;
export declare const isSpriteToken: (nested: Nested<SegmentToken>) => boolean;
export declare const _isTextToken: (t: SegmentToken) => t is TextSegmentToken;
export declare const isTextToken: (nested: Nested<SegmentToken>) => boolean;
export declare const _isWhitespaceToken: (t: SegmentToken) => t is WhitespaceSegmentToken;
export declare const isWhitespaceToken: (nested: Nested<SegmentToken>) => boolean;
export declare const _isNewlineToken: (t: SegmentToken) => t is NewlineSegmentToken;
export declare const isNewlineToken: (t?: Nested<SegmentToken>) => boolean;
export declare const isNotWhitespaceToken: (input: Nested<SegmentToken>) => boolean;
export declare const isEmptyObject: <T>(a: T) => boolean;
export declare const isPixel: (s: string) => boolean;
export declare const isEm: (s: string) => boolean;
export declare const isPercent: (s: string) => boolean;
export declare const pixelToNumber: (s: string) => number;
export declare const emToNumber: (s: string) => number;
export declare const percentStringToNumber: (s: string) => number;
export declare const measurementValueToComponents: (input: MeasurementValue) => MeasurementComponents;
export {};
