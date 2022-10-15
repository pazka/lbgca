let inputMiddleware = []
let outputMiddleware = []

export function registerRestMiddleware(_inputMiddleware, _outputMiddleware) {
    _inputMiddleware && inputMiddleware.push(_inputMiddleware)
    _outputMiddleware && outputMiddleware.push(_outputMiddleware)
}

export function applyIngoingMiddlewares(req) {
    inputMiddleware.forEach((m) => {
        req = m(req)
    })
    return req
}

export function applyOutgoingMiddlewares(res) {
    outputMiddleware.forEach((m) => {
        res = m(res)
    })
    return res
}
