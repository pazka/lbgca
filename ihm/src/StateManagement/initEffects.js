import {fetchAllOrdersEffect} from "./basketEffects";
import {initUser} from "./userEffects";

export const initInventory = () => async (dispatch,getState)=>{
    dispatch(initUser())
    dispatch(fetchAllOrdersEffect())
}

