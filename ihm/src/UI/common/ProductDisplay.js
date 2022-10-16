import {withErrorCaught} from "../../utils/withErrorCaught";
import {useState} from "react";
import {getLorem} from "../../utils/getLorem";
import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardMedia, FormControl,
    IconButton,
    InputLabel, MenuItem,
    Select,
    Typography, useTheme
} from "@mui/material";
import inventory from "../../domain/inventory.json"
import {AddShoppingCart} from "@mui/icons-material";
import {useDispatch} from "react-redux";
import {addOrderToBasketEffect} from "../../StateManagement/basketEffects";


function ProductDisplay(
    {
        product, readonly
    }: {
        product: Product,
        readonly: boolean
    }
) {
    const [currImgIndex, setCurrImgIndex] = useState(0)
    const [currVariant, setCurrVariant] = useState(inventory.globalVariants[0])
    const [currVariantColor, setCurrVariantColor] = useState(inventory.globalVariants[0].colors[0])
    const dispatch = useDispatch()
    const theme = useTheme()

    const setNewVariant = (variant: Variant) => {
        if (!variant.colors.includes(currVariantColor)) {
            setCurrVariantColor(variant.colors[0])
        }
        setCurrVariant(variant)
    }

    const addProductToBasket = () => {
        dispatch(addOrderToBasketEffect(product, currVariant, currVariantColor))
    }

    return <div className={"product-display"}>
        <Card>
            <CardHeader
                sx={{
                    backgroundColor : theme.palette.primary.light
                }}
                color={"secondary"}
                title={product.name}
                action={
                    <Button
                        variant={"outlined"}
                        color={theme.palette.text.primary}
                        aria-label="order"
                        onClick={x => addProductToBasket()}
                    >
                        <AddShoppingCart/>
                    </Button>
                }
            />
            <CardMedia
                component="img"
                height="194"
                image={'phototest.jpg'}
                alt={product.name + " photo"}
            />
            <CardContent>
                {getLorem(3).map(desc => <Typography variant="body2" color="text.primary">
                    {desc}
                </Typography>)}
            </CardContent>
            <CardActions
                disableSpacing
                sx={{
                    backgroundColor: theme.palette.secondary.light,
                    '& >*' : {
                        margin : '0.5em'
                    }
                }}
            >
                <FormControl fullWidth>
                    <InputLabel id="generalVariant">Matière</InputLabel>
                    <Select
                        variant={"standard"}
                        labelId="generalVariant"
                        id="generalVariant"
                        value={currVariant}
                        label="generalVariant"
                        onChange={e => setNewVariant(e.target.value)}
                    >
                        {inventory.globalVariants.map((variant: Variant, i) => (
                            <MenuItem key={i} value={variant}>{variant.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel id="generalVariantColor">Couleur</InputLabel>
                    <Select
                        variant={"standard"}
                        labelId="generalVariantColor"
                        id="generalVariantColor"
                        value={currVariantColor}
                        label="generalVariantColor"
                        onChange={e => setCurrVariantColor(e.target.value)}
                    >
                        {currVariant.colors.map((color, i) => (
                            <MenuItem key={i} value={color}>{color}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </CardActions>
        </Card>
        <div>
        </div>
    </div>
}

export default withErrorCaught(ProductDisplay)
