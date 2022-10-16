import {createSlice} from '@reduxjs/toolkit'
import type {PayloadAction} from '@reduxjs/toolkit'

export interface SessionState {
}

const initialState: SessionState = {
}

export const sessionSlice = createSlice({
    name: 'session',
    initialState,
    reducers: {
        updateSession: (state, action) => {
            state = {...action.payload}
            return state
        }
    },
})

// Action creators are generated for each case reducer function
export const {updateSession} = sessionSlice.actions

export default sessionSlice.reducer