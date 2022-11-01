import {createSlice} from '@reduxjs/toolkit'
import type {PayloadAction} from '@reduxjs/toolkit'

export interface DisplayState {
}

const initialState: DisplayState = {
    noSpoil: false
}

export const displaySlice = createSlice({
    name: 'display',
    initialState,
    reducers: {
        updateNoSpoil: (state, action) => {
            state.noSpoil = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {updateNoSpoil} = displaySlice.actions

export default displaySlice.reducer