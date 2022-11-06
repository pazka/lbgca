import {withErrorCaught} from "../../utils/withErrorCaught";
import {Box, Button, IconButton, Paper, Stack, TextField, Tooltip} from "@mui/material";
import {useDispatch, useSelector} from "react-redux";
import {CheckBox, Delete} from "@mui/icons-material";
import {publishComment, removeOrderFromBasketEffect, validateUserBasket} from "../../StateManagement/basketEffects";
import OrderDisplay from "../common/OrderDisplay";
import {useEffect, useState} from "react";

function MyBasketPage({}) {
    const basket = useSelector(store => store.basketSlice.basket)
    const userProfile = useSelector(store => store.userSlice.profile)
    const [comment, setComment] = useState(userProfile.comment)

    useEffect(() => {
        setComment(userProfile.comment)
    }, [userProfile.comment])

    const dispatch = useDispatch()
    return <Box>
        <h2>Your Basket</h2>
        <Box sx={{
            marginBottom: '1em'
        }}>
            <Stack spacing={2}>
                {basket.map((o: Order) => <Paper
                    className={"small-logo-parent"}
                >
                    <div className={"small-logo"}/>
                    <OrderDisplay order={o}/>
                    {
                        !o.validated ?
                            <IconButton
                                onClick={x => dispatch(removeOrderFromBasketEffect(o))}
                            >
                                <Delete/>
                            </IconButton> :
                            <CheckBox color={"secondary"}/>
                    }
                </Paper>)}
            </Stack>
        </Box>
        {basket.length > 0 && <Tooltip placement={"right"} title={<Box>
            <p>Valider veut juste dire que le panier sera noté comme prêt à fabriquer</p>
            <p>Vous pouvez dé-valider un panier si vous changez d'avis</p>
        </Box>}>
            <Button
                variant={"contained"}
                color={"secondary"}
                onClick={x => dispatch(validateUserBasket(!basket[0].validated))}
            >
                {!basket[0].validated ? "Valider" : "Dé-Valider"} mon panier
            </Button>
        </Tooltip>}
        <br/>
        {basket[0]?.validated ? <Box>
            <TextField
                value={comment}
                onChange={e => setComment(e.target.value)}
                label={"Publiez un avis !"}
                multiline
                margin="normal"
                fullWidth
                rows={3}
            />{comment !== userProfile.comment && <div>
            <Button variant={"contained"} onClick={x => dispatch(publishComment(comment))}>
                Publish
            </Button>
            <Button variant={"outlined"} onClick={x => setComment(userProfile.comment)}>
                Reset
            </Button>
        </div>}
        </Box> : null}
    </Box>
}

export default withErrorCaught(MyBasketPage)