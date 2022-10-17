import {withErrorCaught} from "../../utils/withErrorCaught";
import {useEffect, useState} from "react";
import inventory from "../../domain/inventory.json"
import ProductDisplay from "../common/ProductDisplay";
import {useDispatch, useSelector} from "react-redux";
import {Box, Button} from "@mui/material";
import {Visibility, VisibilityOff} from "@mui/icons-material";
import {updateNoSpoil} from "../../StateManagement/displaySlice";

function OrderPage({}) {
    const displayOption = useSelector(store => store.displaySlice)
    const dispatch = useDispatch()
    return <Box className={"order-page"}>
        <Box sx={{
          display:"flex",
          alignItems : "center",
            
        }}>
            <h2>Les Oeufs du Magasin</h2>
            <Button
                onClick={x => dispatch(updateNoSpoil(!displayOption.noSpoil))}
            >
                <span style={{margin : "0.5em"}}>Mode No Spoil</span>{displayOption.noSpoil ? <Visibility/> : <VisibilityOff/>}
            </Button>
        </Box>

        <div className={"content"}>
            {inventory.products.map((product, i) => <ProductDisplay key={i} product={product}/>)}
        </div>
    </Box>
}

export default withErrorCaught(OrderPage)
