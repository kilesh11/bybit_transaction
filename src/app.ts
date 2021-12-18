import * as dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import axios from "axios";
import qs from "qs";

const api_key = process.env.API_KEY ?? "";
const secret = process.env.API_SECRET ?? "";

const apiUrl = "https://api.bybit.com";
const orderBook = "/spot/quote/v1/depth";
// const bestAskPrice = "/spot/quote/v1/ticker/book_ticker";
const orderBalance = "/spot/v1/account";
const placeOrderUrl = "/spot/v1/order";
const serverTimeUrl = "/spot/v1/time";

const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSignature = (parameters: object, secret: string) => {
    var orderedParams = "";
    Object.keys(parameters)
        .sort()
        .forEach(function (key: string) {
            // @ts-ignore: Unreachable code error
            orderedParams += key + "=" + parameters[key] + "&";
        });
    orderedParams = orderedParams.substring(0, orderedParams.length - 1);

    return crypto.createHmac("sha256", secret).update(orderedParams).digest("hex");
};

const getBalance = async () => {
    const params = { timestamp: Date.now(), api_key };
    const { data: balance } = await axios.get(`${apiUrl}${orderBalance}`, {
        params: { ...params, sign: getSignature(params, secret) }
    });
    // console.dir(balance.result.balances);
    return balance.result.balances.find((symbol: any) => symbol.coin === "USDT").free;
};

const getServerTime = async () => {
    const { data } = await axios.get(`${apiUrl}${serverTimeUrl}`);
    return data.result.serverTime;
};

const placeOrder = async (
    floatPrice: number,
    symbol: string,
    side: "Sell" | "Buy",
    { qty, freeUSDT }: { qty?: number; freeUSDT?: number }
) => {
    // const floatPrice = parseFloat(price);
    const finalPrice =
        side === "Buy"
            ? Math.floor(floatPrice * 1.5 * 100) / 100
            : Math.floor(floatPrice * 100) / 100;
    const timestamp = await getServerTime();
    const finalQty = qty
        ? Math.floor(qty * 100) / 100
        : freeUSDT
        ? Math.floor((freeUSDT / finalPrice) * 100) / 100
        : 0;
    console.dir(`freeUSDT: ${freeUSDT}`);
    console.dir(`finalPrice: ${finalPrice}`);
    if (freeUSDT) console.dir(`qty: ${freeUSDT / finalPrice}`);
    console.dir(`finalQty: ${finalQty}`);
    const params = {
        "account-id": "100009",
        amount: "10.1",
        price: "100.1",
        source: "api",
        symbol: "ethusdt",
        type: "buy-limit",
        "client-order-id": "a0001"
    };
    const sign = getSignature(params, secret);
    const config = {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    };
    const { data: order } = await axios.post(
        `${apiUrl}${placeOrderUrl}`,
        qs.stringify({ ...params, sign }),
        config
    );
    console.dir(order);
    return order.ret_code;
};

const getOrderBook = async (symbol: string) => {
    try {
        const orderBookparams = { symbol, limit: "1" };
        const { data } = await axios.get(`${apiUrl}${orderBook}`, {
            params: { ...orderBookparams }
        });
        console.dir(data.result);
        return data.result;
    } catch (err) {
        console.log(`Error in getting order Book`);
        return undefined;
    }
};

const loopFunction = async (
    symbol: string,
    side: "Buy" | "Sell",
    options: { qty?: number; freeUSDT?: number; maxPrice?: number }
) => {
    try {
        const orderBook = await getOrderBook(symbol);
        if (orderBook) {
            if (orderBook.asks.length > 0 || orderBook.bids.length > 0) {
                console.dir(`Ask Price: ${orderBook.asks[0][0]}`);
                const price = side === "Buy" ? orderBook.asks[0][0] : orderBook.bids[0][0];
                const floatPrice = parseFloat(price);
                if (options.maxPrice && floatPrice > options.maxPrice) {
                    console.log(`Ask Price higher than Max Price`);
                    return { boughtAll: false, latestBalance: undefined };
                }
                const return_code = await placeOrder(floatPrice, symbol, side, options);
                const latestBalance = parseFloat(await getBalance());
                console.dir(`Free USDT: ${latestBalance}`);
                if (latestBalance > 20) {
                    return { boughtAll: false, latestBalance };
                }
                if (return_code === -1151) {
                    // pair not opened
                    return { boughtAll: false, latestBalance };
                }
                return { boughtAll: true, latestBalance };
            }
            console.log(`no ${symbol} order book yet`);
            return { boughtAll: false, latestBalance: options.freeUSDT };
        }
        return { boughtAll: false, latestBalance: undefined };
    } catch (err) {
        console.log(`Error in Loop Function: ${err}`);
        return { boughtAll: false, latestBalance: undefined };
    }
};

(async () => {
    let finish = false;
    let freeUSDT = parseFloat(await getBalance());
    console.dir(`Free USDT: ${freeUSDT}`);
    while (!finish) {
        const [{ boughtAll, latestBalance }] = await Promise.all([
            loopFunction("IZIUSDT", "Buy", { freeUSDT, maxPrice: 2 }),
            timeout(2200)
        ]);
        finish = boughtAll;
        if (latestBalance) freeUSDT = latestBalance;
    }
    console.dir(`Process Completed!`);
})().catch((err) => {
    console.error(err);
});
