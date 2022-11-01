import {deleteData, getData, postData, putData} from "../rest";

export function apiGetAllOrders() {
    return getData('/api/orders')
}

export function apiCreateOrder(product, amount, variant) {
    return postData('/api/order', null, {
        product, amount, variant
    })
}

export function apiDeleteOrder(orderid) {
    return deleteData('/api/order/' + orderid, null, null)
}


export function apiEditOrder(id, amount, variant) {
    return postData('/api/order/' + id, null, {
        amount, variant
    })
}

export function apiConfirmUserBasket(value) {
    return postData('/api/order/validate', null, {
        value
    })
}

export function apiGetUserOrder(id, value) {
    return getData('/api/user/' + id + '/orders', null, null)
}


export function apiEditExample(example) {
    return putData('/api/example/' + example.id, null, example)
}