import {apiCreateOrder, apiGetAllOrders} from "../services/rest-com/endpoints/orderEndpoints";
import {updateBasket, updateOrders} from "./basketSlice";

export const fetchAllOrdersEffect = () => async (dispatch, getState) => {
    const user = getState().userSlice
    const allOrders = await apiGetAllOrders().catch(res => null) ?? []
    dispatch(updateOrders(allOrders))
    const basket = allOrders.filter((order:Order) => order.user_id === user.userid)
    dispatch(updateBasket(basket))
}

export const addOrderToBasketEffect = (product: Product, variant: Variant, color) => async (dispatch, getState) => {
    await apiCreateOrder(product.name, 1, variant.name + " " + color)
    dispatch(fetchAllOrdersEffect())
}