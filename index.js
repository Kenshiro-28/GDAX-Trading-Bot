#!/usr/bin/env node
/*
 ============================================================================
 Name        : GDAX Trading Bot
 Author      : Kenshiro
 Version     : 7.06
 Version     : 7.07
 Copyright   : GNU General Public License (GPLv3)
 Description : Trading bot for the Coinbase Pro exchange
 ============================================================================
 */

const APP_VERSION = "v7.06";
const APP_VERSION = "v7.07";

const GdaxModule = require('coinbase-pro');

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE || '';
const KEY = process.env.TRADING_BOT_KEY || '';
const SECRET = process.env.TRADING_BOT_SECRET || '';
const GDAX_URI = 'https://api.pro.coinbase.com';
const MKR_BTC_CURRENCY_PAIR = 'MKR-BTC';
const ETH_BTC_CURRENCY_PAIR = 'ETH-BTC';
const BITCOIN_TICKER = 'BTC';
const MAKER_TICKER = 'MKR';
const ETHEREUM_TICKER = 'ETH';
const SLEEP_TIME = 30000;
// The seed is the amount of coins that the program will trade continuously
const SEED_MKR_AMOUNT = 1.0;
const SEED_ETH_AMOUNT = 1.0;
// Profit percentage trading a seed
const PROFIT_PERCENTAGE = 2.0; 

const MINIMUM_BUY_PRICE_MULTIPLIER = 100.5 / 100.0;
const MINIMUM_BUY_PRICE_MULTIPLIER = 101.0 / 100.0;

const SELL_PRICE_MULTIPLIER = (100.0 + PROFIT_PERCENTAGE) / 100.0;

let askPriceMAKER = null;
let averagePriceMAKER = null;
let lastBuyOrderIdMAKER = null;
let lastBuyOrderPriceMAKER = null;
let askPriceETH = null;
let averagePriceETH = null;
let lastBuyOrderIdETH = null;
let lastBuyOrderPriceETH = null;
let btcAvailable = 0;
let btcBalance = 0;
let mkrAvailable = 0;
let mkrBalance = 0;
let ethAvailable = 0;
let ethBalance = 0;
let numberOfCyclesCompleted = 0;
let estimatedProfit = 0;
let authenticatedClient = null;
let publicClient = null;
// Callbacks
const buyOrderCallbackMAKER = (error, response, data) => 
{
    if (error)
        return console.log(error);
    if ((data!=null) && (data.status==='pending'))
		lastBuyOrderIdMAKER = data.id;
    return console.log(data);
}
const buyOrderCallbackETH = (error, response, data) => 
{
    if (error)
        return console.log(error);
    if ((data!=null) && (data.status==='pending'))
		lastBuyOrderIdETH = data.id;
    return console.log(data);
}
const sellOrderCallbackMAKER = (error, response, data) => 
{
    if (error)
        return console.log(error);
    if ((data!=null) && (data.status==='pending'))
    {
        estimatedProfit = estimatedProfit + SEED_MKR_AMOUNT * (parseFloat(data.price) - lastBuyOrderPriceMAKER);
		averagePriceMAKER = lastBuyOrderPriceMAKER;          
		lastBuyOrderPriceMAKER = null;
		lastBuyOrderIdMAKER = null;
        numberOfCyclesCompleted++;
 	}
    return console.log(data);
}
const sellOrderCallbackETH = (error, response, data) => 
{
    if (error)
        return console.log(error);
    if ((data!=null) && (data.status==='pending'))
    {
        estimatedProfit = estimatedProfit + SEED_ETH_AMOUNT * (parseFloat(data.price) - lastBuyOrderPriceETH);
        averagePriceETH = lastBuyOrderPriceETH;        
        lastBuyOrderPriceETH = null;
		lastBuyOrderIdETH = null;
        numberOfCyclesCompleted++;
 	}
    return console.log(data);
}
const getProductTickerCallbackMAKER = (error, response, data) => 
{
	if (error)
        return console.log(error);
    if ((data!=null) && (data.ask!=null) && (data.time!=null))
    {
	    askPriceMAKER = parseFloat(data.ask);
        
        if (averagePriceMAKER===null)
            console.log("[MAKER TICKER] Now: " + askPriceMAKER.toFixed(5) + " BTC, time: " + data.time);
        else
            console.log("[MAKER TICKER] Now: " + askPriceMAKER.toFixed(5) + " BTC, average: " + averagePriceMAKER.toFixed(5) + " BTC, time: " + data.time);
		const buyPrice = askPriceMAKER * SEED_MKR_AMOUNT;
        if ((btcAvailable>=buyPrice) && (averagePriceMAKER!=null) && (lastBuyOrderIdMAKER===null))
            placeBuyOrderMAKER();
        else if ((mkrAvailable>=SEED_MKR_AMOUNT) && (lastBuyOrderIdMAKER!=null))
            placeSellOrderMAKER();
         
        if (averagePriceMAKER===null)
            averagePriceMAKER = askPriceMAKER;
        else
            averagePriceMAKER = (averagePriceMAKER * 1000 + askPriceMAKER) / 1001;
            averagePriceMAKER = (averagePriceMAKER * 10000 + askPriceMAKER) / 10001;

		setTimeout(()=>publicClient.getProductTicker(ETH_BTC_CURRENCY_PAIR, getProductTickerCallbackETH), 10000);
    }
}
const getProductTickerCallbackETH= (error, response, data) => 
{
	if (error)
        return console.log(error);
    if ((data!=null) && (data.ask!=null) && (data.time!=null))
    {
	    askPriceETH = parseFloat(data.ask);
       
        if (averagePriceETH==null)
            console.log("\n[ETHER TICKER] Now: " + askPriceETH.toFixed(5) + " BTC, time: " + data.time);
        else
            console.log("\n[ETHER TICKER] Now: " + askPriceETH.toFixed(5) + " BTC, average: " + averagePriceETH.toFixed(5) + " BTC, time: " + data.time);
		
		const buyPrice = askPriceETH * SEED_ETH_AMOUNT;
        if ((btcAvailable>=buyPrice) && (averagePriceETH!=null) && (lastBuyOrderIdETH===null))
            placeBuyOrderETH();
        else if ((ethAvailable>=SEED_ETH_AMOUNT) && (lastBuyOrderIdETH!=null))
            placeSellOrderETH();
         
        if (averagePriceETH===null)
            averagePriceETH = askPriceETH;
        else
            averagePriceETH = (averagePriceETH * 1000 + askPriceETH) / 1001;
            averagePriceETH = (averagePriceETH * 10000 + askPriceETH) / 10001;
    }
}

const getAccountsCallback = (error, response, data) => 
{
    if (error)
        return console.log(error);
    if ((data!=null) && (Symbol.iterator in Object(data)))
    {
        for(var item of data)
        {   
	        if (item.currency===BITCOIN_TICKER)
            {
		        btcAvailable = parseFloat(item.available);
                btcBalance = parseFloat(item.balance);
            }
            else if (item.currency===MAKER_TICKER)
            {
	            mkrAvailable = parseFloat(item.available);
	            mkrBalance = parseFloat(item.balance);
            }
			else if (item.currency===ETHEREUM_TICKER)
            {
	            ethAvailable = parseFloat(item.available);
	            ethBalance = parseFloat(item.balance);
            }
        }
   
        console.log("[BITCOIN WALLET] Available: " + btcAvailable.toFixed(8) + " BTC,  Balance: " + btcBalance.toFixed(8) + " BTC");
        console.log("[MAKER   WALLET] Available: " + mkrAvailable.toFixed(8) + " MKR,  Balance: " + mkrBalance.toFixed(8) + " MKR");
		console.log("[ETHER   WALLET] Available: " + ethAvailable.toFixed(8) + " ETH,  Balance: " + ethBalance.toFixed(8) + " ETH\n");
		console.log("[INFO] Number of cycles completed: " + numberOfCyclesCompleted + ", estimated profit: " + estimatedProfit.toFixed(8) + " BTC\n");
        publicClient.getProductTicker(MKR_BTC_CURRENCY_PAIR, getProductTickerCallbackMAKER);
    }
}
const getFilledPriceCallbackMAKER = (error, response, data) =>  
{
	if (error)
        return console.log(error);
	if ((Array.isArray(data)) && (data.length >= 1))
	{
		lastBuyOrderPriceMAKER = parseFloat(data[0].price);
		let highestPrice;
	
		if (askPriceMAKER>lastBuyOrderPriceMAKER)
		    highestPrice = askPriceMAKER;
		else
		    highestPrice = lastBuyOrderPriceMAKER;
		const sellPrice = highestPrice * SELL_PRICE_MULTIPLIER;
		const sellSize = mkrAvailable - 0.0000001;
		const sellParams = 
		{
		    'price': sellPrice.toFixed(5),
		    'size': sellSize.toFixed(6),
		    'product_id': MKR_BTC_CURRENCY_PAIR,
		    'post_only': true,
		};
		console.log("");
		console.log("\x1b[41m%s\x1b[0m", "[SELL ORDER] Price: " + sellPrice.toFixed(5) + " BTC, size: " + sellSize.toFixed(2) + " MKR"); 
		setTimeout(()=>authenticatedClient.sell(sellParams, sellOrderCallbackMAKER), 3000);
	}
	return console.log(data);
}
const getFilledPriceCallbackETH = (error, response, data) =>  
{
	if (error)
        return console.log(error);
	if ((Array.isArray(data)) && (data.length >= 1))
	{
		lastBuyOrderPriceETH = parseFloat(data[0].price);
		let highestPrice;
	
		if (askPriceETH>lastBuyOrderPriceETH)
		    highestPrice = askPriceETH;
		else
		    highestPrice = lastBuyOrderPriceETH;
		const sellPrice = highestPrice * SELL_PRICE_MULTIPLIER;
		const sellSize = ethAvailable - 0.000000001;
		const sellParams = 
		{
		    'price': sellPrice.toFixed(5),
		    'size': sellSize.toFixed(8),
		    'product_id': ETH_BTC_CURRENCY_PAIR,
		    'post_only': true,
		};
		console.log("");
		console.log("\x1b[41m%s\x1b[0m", "[SELL ORDER] Price: " + sellPrice.toFixed(5) + " BTC, size: " + sellSize.toFixed(2) + " ETH"); 
		setTimeout(()=>authenticatedClient.sell(sellParams, sellOrderCallbackETH), 3000);
	}
	return console.log(data);
}
// Functions
function placeBuyOrderMAKER() 
{
    const minimumBuyPrice = averagePriceMAKER * MINIMUM_BUY_PRICE_MULTIPLIER;
    if (askPriceMAKER>=minimumBuyPrice)
    {
        const buySize = SEED_MKR_AMOUNT;
        const buyParams = 
	    {
            'size': buySize.toFixed(2),
            'product_id': MKR_BTC_CURRENCY_PAIR,
            'type': 'market'
		};
		console.log("");
		console.log("\x1b[42m%s\x1b[0m", "[BUY ORDER] Size: " + buySize.toFixed(2) + " MKR");
        authenticatedClient.buy(buyParams, buyOrderCallbackMAKER);
    }
}
function placeBuyOrderETH() 
{
    const minimumBuyPrice = averagePriceETH * MINIMUM_BUY_PRICE_MULTIPLIER;
    if (askPriceETH>=minimumBuyPrice)
    {
        const buySize = SEED_ETH_AMOUNT;
        const buyParams = 
	    {
            'size': buySize.toFixed(2),
            'product_id': ETH_BTC_CURRENCY_PAIR,
            'type': 'market'
		};
		console.log("");
		console.log("\x1b[42m%s\x1b[0m", "[BUY ORDER] Size: " + buySize.toFixed(2) + " ETH");
        authenticatedClient.buy(buyParams, buyOrderCallbackETH);
    }
}
function placeSellOrderMAKER()
{
	const params = 
	{
    	order_id: lastBuyOrderIdMAKER
	};
	authenticatedClient.getFills(params, getFilledPriceCallbackMAKER);
}
function placeSellOrderETH()
{
	const params = 
	{
    	order_id: lastBuyOrderIdETH
	};
	authenticatedClient.getFills(params, getFilledPriceCallbackETH);
}
// Main logic
console.log("\n");
console.log("          __________  ___   _  __    ______               ___");
console.log("         / ____/ __ \\/   | | |/ /   /_  __/________ _____/ (_)___  ____ _");
console.log("        / / __/ / / / /| | |   /     / / / ___/ __ `/ __  / / __ \\/ __ `/");
console.log("       / /_/ / /_/ / ___ |/   |     / / / /  / /_/ / /_/ / / / / / /_/ / ");
console.log("       \\____/_____/_/  |_/_/|_|    /_/ /_/   \\__,_/\\__,_/_/_/ /_/\\__, /");
console.log("                                                                /____/");   
console.log("                                  ____        __");
console.log("                                 / __ )____  / /_");
console.log("                                / __  / __ \\/ __/");
console.log("                               / /_/ / /_/ / /_ ");
console.log("                              /_____/\\____/\\__/   " + APP_VERSION);
console.log("\n\n\n\n                    \"The Revolution Will Be Decentralized\"");
console.log("\n\n\n\nConnecting to Coinbase Pro in " + parseInt(SLEEP_TIME/1000) + " seconds ..."); 
setInterval(() => 
{
    console.log('\n\n');
    askPriceMAKER = null;
	askPriceETH = null;
    
    btcAvailable = 0;
    btcBalance = 0;
    mkrAvailable = 0;
    mkrBalance = 0;
    ethAvailable = 0;
    ethBalance = 0;
    publicClient = new GdaxModule.PublicClient(GDAX_URI); 
    authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);
    // Get the balance of the wallets and execute the trading strategy
    authenticatedClient.getAccounts(getAccountsCallback);
}, SLEEP_TIME);
