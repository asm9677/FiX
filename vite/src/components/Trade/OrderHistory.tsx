import { FC, useState } from "react";
const OrderHistory: FC = () => {
  const [selectedMenu, setSelectedMenu] = useState<number>(0);
  return (
    <div className="flex flex-col w-full h-full bg-[#131722] text-[#72768f] font-semibold border-t-[0.6px] border-r-[0.6px] border-[#363A45]">
      <div className="flex justify-between w-full h-12 items-center px-6">
        <div className="flex gap-4 ">
          <button
            className={`${selectedMenu == 0 && "text-[#729aff]"}`}
            onClick={() => setSelectedMenu(0)}
          >
            Position (0)
          </button>
          <button
            className={`${selectedMenu == 1 && "text-[#729aff]"}`}
            onClick={() => setSelectedMenu(1)}
          >
            Order (0)
          </button>
          <button
            className={`${selectedMenu == 2 && "text-[#729aff]"}`}
            onClick={() => setSelectedMenu(2)}
          >
            History
          </button>
        </div>
        <div className="flex">
          <button className="text-[#729aff]">Close All</button>
          <div className="border-r-[0.6px] border-r-[#363A45] h-6 mx-4"></div>
          <button>All My Position &gt;</button>
        </div>
      </div>
      <div></div>
    </div>
  );
};

export default OrderHistory;