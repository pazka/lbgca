import {getData, postData, putData} from "../rest";

export function apiGetAllExamples() {
    return getData('/api/example/custom/all')
}

export function apiGetOneExample(exampleId) {
    return getData('/api/example/' + exampleId)
}

export function apiCreateExample(text) {
    return postData('/api/example/', null, {example_text: text})
}

export function apiEditExample(example) {
    return putData('/api/example/' + example.id, null, example)
}
