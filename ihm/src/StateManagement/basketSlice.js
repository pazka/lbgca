import {createSlice} from '@reduxjs/toolkit'
import type {PayloadAction} from '@reduxjs/toolkit'

export interface BasketState {
    basket: Product[],
    orders: Order[]
}

const initialState: BasketState = {
    basket: [],
    orders: []
}

export const basketSlice = createSlice({
    name: 'basket',
    initialState,
    reducers: {
        updateBasket: (state, action) => {
            state.basket = action.payload
        },
        updateOrders: (state, action) => {
            state.orders = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {updateOrders,updateBasket} = basketSlice.actions

export default basketSlice.reducer