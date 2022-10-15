import {getData, postData, putData} from "../rest";

export function apiGetAllExamples() {
    return getData('/example/custom/all')
}

export function apiGetOneExample(exampleId) {
    return getData('/example/' + exampleId)
}

export function apiCreateExample(text) {
    return postData('/example/', null, {example_text: text})
}

export function apiEditExample(example) {
    return putData('/example/' + example.id, null, example)
}
