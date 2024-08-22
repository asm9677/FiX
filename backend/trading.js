var { ethers, WebSocketProvider } = require("ethers");
require("dotenv").config();
const { contracts } = require("./contracts/addresses.js");
const provider = new WebSocketProvider(
  "wss://ethereum-sepolia-rpc.publicnode.com"
);

const signer = new ethers.Wallet("0x" + process.env.PRIVATE_KEY, provider);

const baseAddress = "0x56f7b6eD57d7Ce8804F6f89Dc38D5dF5Ef1f8499";
const quoteAddress = "0x3EA41003BC70e4da782567359B16C47CcF4650C3";

const accountBalanceContract = new ethers.Contract(
  contracts.accountBalance.address,
  contracts.accountBalance.abi,
  signer
);

const clearingHouseContract = new ethers.Contract(
  contracts.clearingHouse.address,
  contracts.clearingHouse.abi,
  signer
);

const poolContract = new ethers.Contract(
  "0xAc4EB76D5eA83Ec19cD88BA2e637415eA0D4428C",
  contracts.uniswapV2Pair.abi,
  signer
);

const routerContract = new ethers.Contract(
  contracts.uniswapV2Router.address,
  contracts.uniswapV2Router.abi,
  signer
);

let longPositions = [];
let shortPositions = [];

const UINT256_MAX = 2n ** 256n - 1n;

const calculateDxDy = (x, y, k) => {
  const dx = x - Math.sqrt((x * y) / k);
  const dy = k * (x - dx) - y;

  return { dx, dy };
};

const abs = (value) => {
  return value < 0n ? -value : value;
};

const getIndexPrice = async () => {
  fetch(
    "https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC&tsyms=USD"
  ).then((response) => response.json().then(setIndexPrice));
};

const setIndexPrice = async (res) => {
  let indexPrice = BigInt(res.RAW.BTC.USD.PRICE * 10 ** 18);
  console.log(res.RAW.BTC.USD.PRICE);
  await accountBalanceContract.setIndexPrice(
    "0x56f7b6eD57d7Ce8804F6f89Dc38D5dF5Ef1f8499",
    indexPrice
  );

  openPosition(indexPrice);
};

const openPosition = async (indexPrice) => {
  const reserves = await poolContract.getReserves();
  const [amount0, amount1] = [reserves[0], reserves[1]];

  const { dx } = calculateDxDy(
    Number(amount0),
    Number(amount1),
    Number(indexPrice) / 10 ** 20
  );

  let amount = BigInt(Math.floor(dx));
  const maxAmount = abs((amount0 * 3n) / 1000n);

  amount =
    amount > maxAmount ? maxAmount : amount < -maxAmount ? -maxAmount : amount;

  if (amount == 0n) {
    return;
  } else if (amount > 0n) {
    buy(amount);
  } else {
    sell(-amount);
  }
};

const buy = async (amount) => {
  if (shortPositions.length) {
    const posaitionHash = shortPositions.pop();
    const position = await clearingHouseContract.getPosition(
      signer.address,
      baseAddress,
      posaitionHash
    );
    const positionSize = position[1];

    let closePercent = BigInt(
      Math.ceil((Number(amount) / Number(positionSize)) * 100)
    );
    if (closePercent > 100n) closePercent = 100n;
    console.log(positionSize, amount, closePercent);
    closePosition(posaitionHash, false, closePercent);
  } else {
    openPositionLong(amount);
  }
};

const sell = async (amount) => {
  if (longPositions.length) {
    const posaitionHash = longPositions.pop();
    const position = await clearingHouseContract.getPosition(
      signer.address,
      baseAddress,
      posaitionHash
    );
    const positionSize = position[1];
    let closePercent = BigInt(
      Math.ceil((Number(amount) / Number(positionSize)) * 100)
    );
    console.log(positionSize, amount, closePercent);
    if (closePercent > 100n) closePercent = 100n;

    closePosition(posaitionHash, true, closePercent);
  } else {
    openPositionShort(amount);
  }
};

const openPositionLong = (amount) => {
  const path = [quoteAddress, baseAddress];
  routerContract.getAmountsIn(amount, path).then((amounts) => {
    clearingHouseContract.openPosition(
      baseAddress,
      false,
      true,
      amounts[0],
      UINT256_MAX,
      amounts[1],
      Math.floor(Date.now() / 1000) + 600,
      {
        gasLimit: 400000,
      }
    );
  });
};

const openPositionShort = (amount) => {
  const path = [quoteAddress, baseAddress];
  routerContract.getAmountsOut(amount, path).then((amounts) => {
    clearingHouseContract.openPosition(
      baseAddress,
      true,
      false,
      amounts[0],
      amounts[1],
      0,
      Math.floor(Date.now() / 1000) + 600,
      {
        gasLimit: 400000,
      }
    );
  });
};

// function closePosition (address baseToken, bytes32 positionHash, uint closePercent, uint slippageAdjustedAmount, uint deadline)
const closePosition = (positionHash, isLong, closePercent) => {
  const slippageAdjustedAmount = isLong ? 0 : UINT256_MAX;
  clearingHouseContract.closePosition(
    baseAddress,
    positionHash,
    closePercent,
    slippageAdjustedAmount,
    Math.floor(Date.now() / 1000) + 600,
    {
      gasLimit: 400000,
    }
  );
};

// event UpdatePosition(address indexed trader, address indexed baseToken, bytes32 positionHash, uint margin, uint positionSize, uint openNotional);
const filter = clearingHouseContract.filters.UpdatePosition(signer.address);
clearingHouseContract.on(filter, (event) => {
  clearingHouseContract
    .getPosition(signer.address, baseAddress, event.args[2])
    .then((res) => {
      res[3]
        ? longPositions.push(event.args[2])
        : shortPositions.push(event.args[2]);
    });
});

setInterval(() => {
  getIndexPrice();
}, 60 * 1000);

// setTimeout(() => {
//   getIndexPrice();
// }, 100);
// closePosition(
//   "0x3F8F6796FC06C5400B70D62A274A93A3CAB09C4E2583AC7F162E59FF1F603B0C",
//   true
// );

// nohup node trading.js > trading.out 2>&1 &