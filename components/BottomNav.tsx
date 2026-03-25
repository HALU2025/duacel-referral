'use client'

import { LayoutDashboard, ClipboardList, QrCode, UserCircle, Users } from 'lucide-react'

export function BottomNav({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 ${activeTab === 'stats' ? 'text-indigo-600' : 'text-gray-400'}`}>
        <LayoutDashboard className="w-6 h-6" />
        <span className="text-[10px] font-bold">状況</span>
      </button>
      
      <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-indigo-600' : 'text-gray-400'}`}>
        <ClipboardList className="w-6 h-6" />
        <span className="text-[10px] font-bold">明細</span>
      </button>
      
      {/* 中央のQRボタンを目立たせる */}
      <div className="relative -mt-8">
        <button onClick={() => setActiveTab('qr')} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 border-4 border-white active:scale-90 transition">
          <QrCode className="w-7 h-7" />
        </button>
      </div>
      
      <button onClick={() => setActiveTab('staff')} className={`flex flex-col items-center gap-1 ${activeTab === 'staff' ? 'text-indigo-600' : 'text-gray-400'}`}>
        <Users className="w-6 h-6" />
        <span className="text-[10px] font-bold">管理</span>
      </button>
      
      <button onClick={() => setActiveTab('me')} className={`flex flex-col items-center gap-1 ${activeTab === 'me' ? 'text-indigo-600' : 'text-gray-400'}`}>
        <UserCircle className="w-6 h-6" />
        <span className="text-[10px] font-bold">マイ</span>
      </button>
    </nav>
  )
}