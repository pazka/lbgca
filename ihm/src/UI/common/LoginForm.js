import {Button, DialogActions, DialogContent, DialogTitle, TextField} from "@mui/material";
import {useState} from "react";

import {useDispatch, useSelector} from "react-redux";
import {tryLoginEffect} from "../../StateManagement/userEffects";

const isFormValid = (form) => {
    const errors = {}
    if (!form.login || form.login.length < 3) {
        errors.login = "Login must be 3 char long"
    }

    return errors
}

export default function LoginForm({onClose = x => x}) {
    const session = useSelector(store => store.userSlice)
    const dispatch = useDispatch()
    const [isSignup, setIsSignup] = useState(false)
    const [form, setForm] = useState({})
    const [errors, setErrors] = useState({})

    const dataBind = field => e => {
        setErrors({})
        setForm({...form, [field]: e.target.value})
    }

    const sendForm = x => {
        const errors = isFormValid(form)
        if (Object.keys(errors).length > 0) {
            setErrors(errors)
            return
        }

        dispatch(tryLoginEffect(form.login, "nopassword"))

        onClose()
    }

    return <>
        <DialogTitle>
            {isSignup ? "Signup" : "Login"}
        </DialogTitle>
        <DialogContent style={{padding: "2em", display: "flex", flexDirection: "column"}}>
            <TextField
                onChange={dataBind("login")}
                error={errors.login != null}
                helperText={errors.login ?? ""}
                label={"login"}
                value={form.login ?? ""}
            />
        </DialogContent>
        <DialogActions>
            <Button variant={"contained"} onClick={x => sendForm()}>{isSignup ? "Signup" : "Login"} </Button>
            <Button variant={"contained"} color={"secondary"} onClick={onClose}>Close</Button>
        </DialogActions></>
}
