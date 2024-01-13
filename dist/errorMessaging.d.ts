import TaggedText from "./TaggedText";
import { ErrorHandler } from "./types";
export declare const logWarning: (handler?: ErrorHandler, supressConsole?: boolean, target?: TaggedText) => (code: string, message: string) => void;
export declare const logError: (handler?: ErrorHandler, supressConsole?: boolean, target?: TaggedText) => (code: string, message: string) => void;
