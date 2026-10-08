import { createSerializer } from "nuqs/server";
import { libraryParams, libraryUrlKeys } from "./search-params";

/** Builds a /library link with filters applied, e.g. libraryUrl({ genre: ["Fiction"] }) → "/library?g=Fiction". */
export const libraryUrl = createSerializer(libraryParams, { urlKeys: libraryUrlKeys }).bind(null, "/library");
