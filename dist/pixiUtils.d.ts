import * as PIXI from "pixi.js";
import { IFontMetrics } from "./types";
export declare const measureFont: (context: {
    font: string;
}) => IFontMetrics;
export declare const INITIAL_FONT_PROPS: IFontMetrics;
export declare const getFontPropertiesOfText: (textField: PIXI.Text, forceUpdate?: boolean) => IFontMetrics;
export declare const addChildrenToContainer: (children: PIXI.DisplayObject[], container: PIXI.Container) => void;
export declare const cloneSprite: (el: PIXI.Container) => PIXI.Container;
export declare const fontSizeStringToNumber: (size: string) => number;
