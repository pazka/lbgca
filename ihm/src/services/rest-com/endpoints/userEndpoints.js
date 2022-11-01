import {getData, postData} from "../rest";


export async function apiGetUserProfile(username) {
    return getData(`/api/user/${username}`)
}

export async function apiPostUserProfile(data) {
    return postData(`/api/user`,null,data)
}

export function apiGetUserDrawings(userId) {
    return getData(`/api/user/${userId}/drawings`)
}

export function apiGetUserComments(userId) {
    return getData(`/api/user/${userId}/comments`)
}
