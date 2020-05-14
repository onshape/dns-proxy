#!/bin/bash -ex
if [ -z $BUILD_NUMBER ]; then
    echo "Error - BUILD_NUMBER is unset."
    exit 1
fi

echo "Building DNS proxy docker image"
. ./buildSrc/tools/bash/buildtools.bash
getBuildTools ada7fa46229a53f8ba5f8883c8e3f79188744205
dockerRegistryUrl=$(getDockerRegistryUrl)

itemName="dns-proxy"
docker rmi -f $(docker images --format '{{.Repository}}:{{.Tag}}' | grep ${itemName}:) > /dev/null 2>&1 || true
docker build --tag $dockerRegistryUrl/${itemName}:1.0.${BUILD_NUMBER} .
docker tag $dockerRegistryUrl/${itemName}:1.0.${BUILD_NUMBER} $dockerRegistryUrl/${itemName}:latest
dockerPush $dockerRegistryUrl/${itemName}
docker rmi -f $(docker images --format '{{.Repository}}:{{.Tag}}' | grep ${itemName}:)
