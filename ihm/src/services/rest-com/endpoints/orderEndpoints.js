import {deleteData, getData, postData, putData} from "../rest";

export function apiGetAllOrders() {
    return getData('/orders')
}

export function apiCreateOrder(product, amount, variant) {
    return postData('/order', null, {
        product, amount, variant
    })
}

export function apiDeleteOrder(orderid) {
    return deleteData('/order/' + orderid, null, null)
}


export function apiEditOrder(id, amount, variant) {
    return postData('/order/' + id, null, {
        amount, variant
    })
}

export function apiConfirmUserBasket(value) {
    return postData('/order/validate', null, {
        value
    })
}

export function apiGetUserOrder(id, value) {
    return getData('/user/' + id + '/orders', null, null)
}


export function apiEditExample(example) {
    return putData('/example/' + example.id, null, example)
}