import {Avatar} from "@mui/material";

function Base64Avatar({base64Avatar, text = ""}) {

    if (!base64Avatar)
        return <Avatar>{text[0]}</Avatar>

    return <Avatar src={"data:image/jpeg;base64," + base64Avatar}/>
}

export default Base64Avatar
