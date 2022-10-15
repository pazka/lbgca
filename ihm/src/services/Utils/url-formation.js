
/**
 *
 * @param {string}  qs url params to convert into an object
 * @returns obj simple dictionary of query {"param name" : "query param value"}
 */

export function queryParamToObj(qs){
    let queryObj = {}

    let queryParams = qs.match(/\w*=\w*/) || []

    queryParams.forEach(qp =>{
        queryObj[qp.split('=')[0]] = qp.split('=')[1]
    })

    return queryObj
}

/**
 * 
 * @param obj simple dictionary of {"param name" : "query param value"}
 * @returns {string} Url encoded query params to be put in url request
 */
export function objToQueryParams(obj) {
    if (!obj)
        return ""

    return "?" + Object.keys(obj).sort().map(k => `${k}=${encodeURIComponent(obj[k])}`).join('&')
}
