/* Minimal config for Emscripten build of libantiprism (no GLUT/aview). */
#ifndef ANTIPRISM_WASM_CONFIG_H
#define ANTIPRISM_WASM_CONFIG_H

#define FOUND_GLU 0
#define GLUT_TYPE 0
#define HAVE_CXX14 1
#define HAVE_DLFCN_H 1
#define HAVE_FLOAT_H 1
#define HAVE_FLOOR 1
#define HAVE_INTTYPES_H 1
#define HAVE_LIBM 1
#define HAVE_LIMITS_H 1
#define HAVE_MEMSET 1
#define HAVE_MODF 1
#define HAVE_POW 1
#define HAVE_SQRT 1
#define HAVE_STDBOOL_H 1
#define HAVE_STDINT_H 1
#define HAVE_STDIO_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRCASECMP 1
#define HAVE_STRCHR 1
#define HAVE_STRCSPN 1
#define HAVE_STRDUP 1
#define HAVE_STRERROR 1
#define HAVE_STRING_H 1
#define HAVE_STRNCASECMP 1
#define HAVE_STRRCHR 1
#define HAVE_STRSTR 1
#define HAVE_STRTOL 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_UNISTD_H 1
#define LT_OBJDIR ".libs/"
#define PACKAGE "antiprism"
#define PACKAGE_BUGREPORT "adrian@antiprism.com"
#define PACKAGE_NAME "antiprism"
#define PACKAGE_STRING "antiprism 0.32.99"
#define PACKAGE_TARNAME "antiprism"
#define PACKAGE_URL ""
#define PACKAGE_VERSION "0.32.99"
#define VERSION "0.32.99"
#define STDC_HEADERS 1

/* Subsecond timer / sleep backends (see base/timer.cc). */
#define UTIMER 1 /* gettimeofday */
#define USLEEP 1 /* usleep */

#endif /* ANTIPRISM_WASM_CONFIG_H */
