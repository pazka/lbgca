import {cloneDeep} from "lodash";

export function deepClone<T>(objectToClone:T) : T {
    return cloneDeep(objectToClone);
}

export function isNullUndefOrWhitespace(str: String) {
    return (str === undefined || str === null || String(str).trim().length === 0)
}

export function arrayBufferToBase64Bis(buffer) {
    return (btoa(unescape(encodeURIComponent(buffer))));
}

export function strcmp(a, b) {
    return (a < b ? -1 : (a > b ? 1 : 0));
}

export function toCamelCase(str: string, sep: string = ' ') {
    return str
        .toLowerCase()
        .split(sep)
        .map(s => (s[0] ?? "").toUpperCase() + s.slice(1, s.length - 2))
        .join('')
}

export function toSnakeCase(str: string, sep: string = ' ') {
    return str
        .toLowerCase()
        .split(sep)
        .join('_')
}

export function toKebabCase(str: string, sep: string = ' ') {
    return str
        .toLowerCase()
        .split(sep)
        .join('-')
}

export function toCapitalized(str: string, sep: string = ' ') {
    return str
        .toLowerCase()
        .split(sep)
        .map(s => ((s[0] ?? "").toUpperCase() + (s.slice(1, s.length))))
        .join(sep)
}

export function isEmpty(val: any) {
    if (typeof val === "boolean") {
        return !(val === true || val === false)
    }

    if (val === undefined || val === null)
        return true

    if (typeof val === "object") {
        return Object.keys(val).length === 0
    }

    return (String(val).trim().length === 0)
}

export function isNull(val) {
    return (val === null || val === undefined)
}

export function zeroIfEmpty(val) {
    if (typeof val === "boolean") {
        console.error('The value converted was a boolean, if the bool is true the result will be true')
    }

    if (isNullUndefOrWhitespace(val)) {
        return 0
    } else {
        return val
    }
}

export function nullIfEmpty(val) {
    if (typeof val === "boolean") {
        console.error('The value converted was a boolean, if the bool is true the result will be true')
    }

    if (isNullUndefOrWhitespace(val)) {
        return null
    } else {
        return val
    }
}

export function valIfEmpty(val, valIfEmpty) {
    if (typeof val === "boolean") {
        console.error('The value converted was a boolean, if the bool is true the result will be true')
    }

    if (isNullUndefOrWhitespace(val)) {
        return valIfEmpty
    } else {
        return val
    }
}

export function isObjEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2)
}

export function removeKey(objToMutate, keyToRemove) {
    return Object.keys(objToMutate).filter(key =>
        key !== keyToRemove).reduce((obj, key) => {
            obj[key] = objToMutate[key];
            return obj;
        }, {}
    );
}

export function safeStringify(obj, spacer, nb) {
    console.error("Not implemented for now")
    return JSON.stringify(obj, spacer, nb)
}

/**
 * Generate a hash out of the passed obj string int or
 * @param val
 */
export function h(val) {
    if (typeof val === "boolean") {
        return !(val === true || val === false)
    }

    if (val === undefined || val === null)
        return true

    if (typeof val === "object") {
        val = JSON.stringify(val)
    }

    var hash = 0;
    for (var i = 0; i < val.length; i++) {
        var character = val.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; // Convert to 32bit integer
    }

    return hash;
}

export function filterWithArray(arrToClean: Array<any>, elementsToRemove: Array<any>) {
    return arrToClean.filter(x => !elementsToRemove.includes(x))
}

export function removeNull(arrToClean: Array<any>) {
    return filterWithArray(arrToClean, [null, undefined, NaN])
}

export function dateToDTOString(dateToConvert: Date) {
    if (!dateToConvert)
        throw Error('No date to convert')

    if (typeof dateToConvert === "string")
        return dateToConvert

    if (typeof dateToConvert === "number")
        dateToConvert = new Date(dateToConvert)

    return dateToConvert.toISOString()
}

export function setHourSecondsToZero(dateIOTypeToConvert) {
    return new Date(dateIOTypeToConvert.toLocaleString().split(',')[0])
}

export function setHourSecondsTo24(dateIOTypeToConvert) {
    return new Date(dateIOTypeToConvert.toLocaleString().split(',')[0] + ', 11:59:00 PM')
}

export function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

export function firstKey(obj){
    if(typeof obj !== "object")
        throw Error("obj is not an object")

    return Object.keys(obj)[0]
}

export function mapArrayToDict (array : Array<any> = [],key : string){
    const obj = {}
    array.forEach(el =>( obj[el[key]] = el))

    return obj
}

export function isInBothArray(el,a,b){
    return (a.findIndex(el)> -1) && (b.findIndex(el)> -1)
}

export function firstCommonElementToTheTwoArrays(a,b){
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            if(a[i]===b[j]) return cloneDeep(a[i])
        }
    }

    return undefined
}
