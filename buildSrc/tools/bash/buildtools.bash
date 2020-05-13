#!/bin/bash

getBuildTools() {
    local sha=${1:-$BUILD_TOOLS_VERSION}
    local bold="\033[1m"
    local normal="\033[0m"
    local tmpDir=$(mktemp -d -t gbtXXXXXX)
    [[ $? != 0 ]] && return 1 || true
    local cloneDir=$tmpDir/build-tools
    echo -e "${bold}Cloning build-tools/commit/$sha ... ${normal}"
    git clone --quiet git@github.com:onshape/build-tools.git ${cloneDir}
    pushd ${cloneDir} > /dev/null
    git checkout --quiet ${sha}
    . ./buildenv.bash
    popd > /dev/null
    rm -rf ${cloneDir}
    rmdir ${tmpDir}
}
export -f getBuildTools
