#!/bin/bash

btGetDirTreeHashFile() {
    if [[ $1 == "" ]]; then
        echo ".dirtreehash"
    else
        echo "$1/.dirtreehash"
    fi
}
export -f btGetDirTreeHashFile


btGetDirTreeHash() {
    [ "$2" ] || { echo "Usage: btGetDirTreeHash dir return_hash" >&2; return 1; }
    local hashFile=$(btGetDirTreeHashFile)
    local hash="$(cd "$1"; find . \( ! -name "$hashFile" \) -type f -print0 | xargs -0 openssl dgst -sha256 | sed 's/^.*= //' | openssl dgst -sha256 | sed 's/^.*= //')"
    if [[ "$hash" =~ ^[a-f0-9]{64}$ ]]; then
       eval $2='$hash'
    else
       echo "btGetDirTreeHash() error - invalid SHA256 '$hash'" >&2
       return 1
    fi
}
export -f btGetDirTreeHash

btGetBuildTools() {
    local sha=${1:-$BUILD_TOOLS_VERSION}
    local cloneDir=${2}
    local calcDirTreeHash

    if [[ "$cloneDir" == "" ]]; then
        local tmpFile=$(mktemp -t gbtXXXXXX)
        rm -f tmpFile
        cloneDir=${tmpFile%/*}/build-tools."$sha"
    fi

    if [ -d "$cloneDir" ]; then
        local hashFile=$(btGetDirTreeHashFile "$cloneDir")
        if [ -e "$hashFile" ]; then
            local dirTreeHash=$(cat "$hashFile")
            if btGetDirTreeHash "$cloneDir" calcDirTreeHash; then
                [[ "$calcDirTreeHash" != "$dirTreeHash" ]] && rm -rf "$cloneDir"
            else
                return 1
            fi
        else
            rm -rf "$cloneDir"
        fi
    fi

    if [ ! -d "$cloneDir" ]; then
        echo -e "\033[1mCloning build-tools/commit/$sha ...\033[0m"
        git clone --quiet git@github.com:onshape/build-tools.git "$cloneDir"
        (cd "$cloneDir"; git checkout --quiet "$sha")
        if btGetDirTreeHash "$cloneDir" calcDirTreeHash; then
            echo "$calcDirTreeHash" > $(btGetDirTreeHashFile "$cloneDir")
        else
            rm -rf "$cloneDir"
            return 1
        fi
    fi

    pushd "$cloneDir" > /dev/null
    . ./buildenv.bash
    popd > /dev/null

    # cloneDir needs to persist for items like cacerts, will be removed by tmpreaper
}
export -f btGetBuildTools
