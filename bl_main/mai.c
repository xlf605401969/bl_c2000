#include "bl_main.h"

int main()
{
    bl_main_init();
    while (1) {
        bl_main_process();
    }
}
