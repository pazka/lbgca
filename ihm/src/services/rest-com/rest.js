import * as axios from "axios"
import {getBaseUrl} from "../config";
import {objToQueryParams} from "../Utils/url-formation";
import {applyIngoingMiddlewares, applyOutgoingMiddlewares, registerRestMiddleware} from "./middlewares";
import {baseIngoingMiddleware, baseOutgoingMiddleware} from "./middlewares/baseMiddleware";
import {errorIngoingMiddleware, errorOutgoingMiddleware} from "./middlewares/errorMiddleware";

registerRestMiddleware(errorIngoingMiddleware, errorOutgoingMiddleware)
registerRestMiddleware(baseIngoingMiddleware, baseOutgoingMiddleware)

axios.interceptors.request.use(applyOutgoingMiddlewares, err => applyOutgoingMiddlewares(err.request, err));

axios.interceptors.response.use(applyIngoingMiddlewares, err => applyIngoingMiddlewares(err.response, err));
axios.defaults.withCredentials = true

export async function postData(urlPath = '', queryParams, data) {
    return axios.post(getBaseUrl() + urlPath + objToQueryParams(queryParams), data, {withCredentials: true});
}

export async function postFormData(urlPath = '', queryParams, data) {
    var formData = new FormData();
    Object.keys(data).forEach(k => (formData.append(k, data[k])))

    return axios({
        method: "post",
        url: getBaseUrl() + urlPath + objToQueryParams(queryParams),
        data: formData,
        headers: {"Content-Type": "multipart/form-data"},
    })
}

export async function getData(urlPath = '', queryParams) {
    return await axios.get(getBaseUrl() + urlPath + objToQueryParams(queryParams), {withCredentials: true});
}

export async function putData(urlPath = '', queryParams, data) {
    return axios.put(getBaseUrl() + urlPath + objToQueryParams(queryParams), data, {withCredentials: true});
}

export async function patchData(urlPath = '', queryParams, data) {
    return axios.patch(getBaseUrl() + urlPath + objToQueryParams(queryParams), data, {withCredentials: true});
}

export async function deleteData(urlPath = '', queryParams) {
    return await axios.delete(getBaseUrl() + urlPath + objToQueryParams(queryParams), {withCredentials: true});
}
