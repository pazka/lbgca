import {getData, postData} from "../rest";


export async function apiGetUserProfile(username) {
    return getData(`/user/${username}`)
}

export async function apiPostUserProfile(data) {
    return postData(`/user`,null,data)
}

export function apiGetUserDrawings(userId) {
    return getData(`/user/${userId}/drawings`)
}

export function apiGetUserComments(userId) {
    return getData(`/user/${userId}/comments`)
}
