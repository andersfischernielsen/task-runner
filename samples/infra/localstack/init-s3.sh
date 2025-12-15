#!/bin/bash
set -e

echo "Initializing LocalStack S3..."

sleep 5

awslocal s3 mb s3://images
awslocal s3 mb s3://uploads

awslocal s3 cp /test-data/fish.jpg s3://uploads/test-image.jpg

echo "LocalStack S3 initialized with test image at s3://uploads/test-image.jpg"

awslocal s3 ls s3://uploads/
