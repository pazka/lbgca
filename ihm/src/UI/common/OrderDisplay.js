import {Box} from "@mui/material";
import {withErrorCaught} from "../../utils/withErrorCaught";

function OrderDisplay({order}: { order: Order }) {
    return <Box><b>{order.product}</b> · {order.variant}</Box>
}

export default withErrorCaught(OrderDisplay)