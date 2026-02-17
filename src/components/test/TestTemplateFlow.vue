<template>
  <div class="p-8 bg-[#0d0f11] min-h-screen text-slate-200 font-sans">
    <div class="grid grid-cols-[2fr_3fr_3fr_4fr] gap-4 w-full max-w-6xl">
      
      <div v-for="i in 4" :key="i" class="relative h-12 group z-10 hover:z-20">
        
        <div class="absolute inset-y-0 left-0 bg-[#1a1c1e] border border-slate-700 rounded-lg shadow-lg
                    w-full group-hover:w-[calc(100%+40px)] 
                    transition-all duration-300 ease-in-out
                    overflow-hidden z-10">
          <div class="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center 
                      bg-blue-600 hover:bg-blue-500 text-white cursor-pointer
                      translate-x-full group-hover:translate-x-0 
                      transition-transform duration-300">
            <span class="text-xl font-bold">+</span>
          </div>
        </div>

        <div class="absolute inset-0 w-full h-full px-3 z-20 pointer-events-none flex items-center">
            
          <div class="grid grid-cols-[1fr_auto] items-center w-full relative">
            
            <div class="col-start-1 col-end-3 row-start-1 text-sm whitespace-nowrap z-0 pr-2 group-hover:text-white transition-colors">
              Advanced Composites High End Production Module #{{i}}
            </div>

            <div class="col-start-2 row-start-1 z-10 flex items-center h-full ml-auto">
              
              <div class="pl-8 pr-2 h-full flex items-center gap-1
                          bg-gradient-to-r from-transparent via-[#1a1c1e] via-30% to-[#1a1c1e] group-hover:opacity-0">
                <span class="bg-slate-800 text-slate-400 text-[10px] px-1 rounded">CH4</span>
                <span class="bg-slate-800 text-slate-400 text-[10px] px-1 rounded">Ore</span>
              </div>

              <div class="h-full flex items-center bg-[#1a1c1e] 
                          transition-opacity duration-300">
                <span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30">
                  x4.2
                </span>
              </div>

            </div>

          </div>
          
        </div>

      </div>

    </div>
  </div>
</template>