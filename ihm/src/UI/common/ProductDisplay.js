import {withErrorCaught} from "../../utils/withErrorCaught";
import {useState} from "react";
import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardMedia,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Typography,
    useTheme
} from "@mui/material";
import inventory from "../../domain/inventory.json"
import {AddShoppingCart} from "@mui/icons-material";
import {useDispatch, useSelector} from "react-redux";
import {addOrderToBasketEffect} from "../../StateManagement/basketEffects";


function ProductDisplay(
    {
        product, readonly
    }: {
        product: Product,
        readonly: boolean
    }
) {
    const displayOptions = useSelector(store => store.displaySlice)
    const basket = useSelector(store => store.basketSlice.basket)
    const [currImgIndex, setCurrImgIndex] = useState(0)
    const [currVariant, setCurrVariant] = useState(inventory.globalVariants[0].name)
    const [currOption, setCurrOption] = useState((product.variants ?? [])[0])
    const [currVariantColor, setCurrVariantColor] = useState(inventory.globalVariants[0].colors[0])
    const dispatch = useDispatch()
    const theme = useTheme()

    const setNewVariant = (variantName) => {
        const variant = inventory.globalVariants.find(v => v.name === variantName)
        if (!variant.colors.includes(currVariantColor)) {
            setCurrVariantColor(variant.colors[0])
        }
        setCurrVariant(variant.name)
    }

    const addProductToBasket = () => {
        dispatch(addOrderToBasketEffect(product, inventory.globalVariants.find(v => v.name === currVariant), currVariantColor, currOption))
    }

    return <div className={"product-display"}>
        <Card>
            <CardHeader
                sx={{
                    backgroundColor: theme.palette.primary.light
                }}
                color={"secondary"}
                title={product.name}
                action={
                    !basket[0]?.validated ? (<Button
                        variant={"contained"}
                        color="secondary"
                        aria-label="order"
                        onClick={x => addProductToBasket()}
                    >
                        <AddShoppingCart/>
                    </Button>) : <div></div>
                }
            />
            <CardMedia
                sx={(displayOptions.noSpoil ? {
                    filter: "blur(0.5em)"
                } : {})}
                component="img"
                height="194"
                image={product.images[currImgIndex]}
                alt={product.name + " photo"}
            />
            <CardContent>
                {product.description.map((desc, i) => <Typography
                    sx={{marginBottom: '0.5em'}}
                    variant="body2"
                    color="text.primary.main"
                    key={i}
                >
                    {desc}
                </Typography>)}
            </CardContent>
            <CardActions
                disableSpacing
                sx={{
                    backgroundColor: theme.palette.secondary.light,
                    '& >*': {
                        margin: '0.5em'
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
                            <MenuItem key={i} value={variant.name}>{variant.name}</MenuItem>
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
                        {inventory.globalVariants.find(v => v.name === currVariant).colors.map((color, i) => (
                            <MenuItem key={i} value={color}>{color}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {
                    product.variants && <FormControl fullWidth>
                        <InputLabel id="currOption">Option</InputLabel>
                        <Select
                            variant={"standard"}
                            labelId="currOption"
                            id="currOption"
                            value={currOption}
                            label="currOption"
                            onChange={e => setCurrOption(e.target.value)}
                        >
                            {product.variants.map((v, i) => (
                                <MenuItem key={i} value={v}>{v}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                }
            </CardActions>
        </Card>
        <div>
        </div>
    </div>
}

export default withErrorCaught(ProductDisplay)
