import {getData, postData, putData} from "../rest";

export function apiGetAllOrders() {
    return getData('/orders')
}

export function apiCreateOrder(product, amount, variant) {
    return postData('/order', null, {
        product, amount, variant
    })
}

export function apiEditOrder(id, amount, variant) {
    return postData('/order/' + id, null, {
        amount, variant
    })
}

export function apiConfirmOrder(id, value) {
    return postData('/order/' + id + "/confirm", null, {
        value
    })
}

export function apiGetUserOrder(id, value) {
    return getData('/user/' + id + '/orders', null, null)
}


export function apiEditExample(example) {
    return putData('/example/' + example.id, null, example)
}
