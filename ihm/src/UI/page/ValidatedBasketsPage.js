import {withErrorCaught} from "../../utils/withErrorCaught";
import {Box, Paper, TextField} from "@mui/material";
import {useSelector} from "react-redux";
import OrderDisplay from "../common/OrderDisplay";

function ValidatedBasketsPage({}) {
    const allOrders = useSelector(store => store.basketSlice.orders)
    const allGroupedValidatedOrders: { uid: number, orders: Order[] }[] = []
    allOrders.forEach((o: Order) => {
        if (!o.validated) return;
        let orderGroup = allGroupedValidatedOrders.find(go => go.uid === o.user_id) ?? {}
        if (!orderGroup.uid) {
            orderGroup.uid = o.user_id
            orderGroup.orders = []
            allGroupedValidatedOrders.push(orderGroup)
        }
        orderGroup.orders.push(o)
    })

    return <Box sx={{
        display: "flex",
        alignItems: "center",
        justifyItems: "space-around",
        flexWrap: "wrap"
    }}>
        {allGroupedValidatedOrders.map((go, i) => (
            <Paper key={i}
                   elevation={4}
                   sx={{
                       margin: '1em',
                       width: "fit-content",
                       padding: "1em",
                       display: "flex",
                       flexDirection: "column",
                       alignItems: "center"
                   }}
                   className={"small-logo-parent"}
            >
                <div className={"small-logo"}></div>
                <div>{go.orders[0].user.username}</div>
                <Box
                    sx={{
                        width: "fit-content",
                        padding: "1em",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center"
                    }}
                >
                    {
                        go.orders.map((o, i) => <OrderDisplay key={i} order={o}/>)
                    }
                    {go.orders[0].user.comment && <TextField 
                        label={"Satisfaction"} 
                        value={go.orders[0].user.comment}
                        variant={"standard"}
                        margin="normal"
                        multiline
                        fullWidth
                    />}
                </Box>
            </Paper>))}
    </Box>
}

export default withErrorCaught(ValidatedBasketsPage)