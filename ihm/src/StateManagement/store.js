import {configureStore} from '@reduxjs/toolkit'
import basketSlice from "./basketSlice";
import userSlice from "./userSlice";
import displaySlice from "./displaySlice";

export const store = configureStore({
    reducer: {
        basketSlice,
        userSlice,
        displaySlice
    },
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
            thunk: {}
        })
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch