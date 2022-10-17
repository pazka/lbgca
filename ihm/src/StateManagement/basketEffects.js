import {
    apiConfirmUserBasket,
    apiCreateOrder,
    apiDeleteOrder,
    apiGetAllOrders
} from "../services/rest-com/endpoints/orderEndpoints";
import {updateBasket, updateOrders} from "./basketSlice";
import {apiGetSession} from "../services/rest-com/endpoints/loginEndpoints";
import {apiPostUserProfile} from "../services/rest-com/endpoints/userEndpoints";
import {initUser} from "./userEffects";

export const fetchAllOrdersEffect = () => async (dispatch, getState) => {
    const allOrders = await apiGetAllOrders().catch(res => null) ?? []
    dispatch(updateOrders(allOrders))
}

export const getMyBasketEffect = () => async (dispatch, getState) => {
    const user = await apiGetSession()
    const allOrders = await apiGetAllOrders().catch(res => null) ?? []
    const basket = allOrders.filter((order: Order) => order.user_id === user.userid)
    dispatch(updateBasket(basket ?? []))
}

export const addOrderToBasketEffect = (product: Product, variant: Variant, color = "", option = "") => async (dispatch, getState) => {
    await apiCreateOrder(product.name, 1, variant.name + " " + color + " " + option)
    dispatch(fetchAllOrdersEffect())
    dispatch(getMyBasketEffect())
}

export const removeOrderFromBasketEffect = (order: Order) => async (dispatch, getState) => {
    await apiDeleteOrder(order.id)
    dispatch(fetchAllOrdersEffect())
    dispatch(getMyBasketEffect())
}


export const validateUserBasket = (value) => async (dispatch, getState) => {
    await apiConfirmUserBasket(value)
    dispatch(fetchAllOrdersEffect())
    dispatch(getMyBasketEffect())
}

export const publishComment = (comment) => async (dispatch, getState) => {
    const users = getState().userSlice
    const user = users.profile
    await apiPostUserProfile({...user, comment})
    dispatch(initUser())
    dispatch(fetchAllOrdersEffect())
    
}