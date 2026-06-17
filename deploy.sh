#!/bin/bash
# AWS EC2 Ubuntu Deployment Script

echo "Updating system and installing Docker..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

export AWS_PUBLIC_IP=$(curl -s http://checkip.amazonaws.com)

echo ""
echo "================================================="
echo "Your Public IP is: $AWS_PUBLIC_IP"
echo "================================================="
echo ""

read -p "Enter your GROQ_API_KEY (or press enter if already in .env): " USER_GROQ_KEY
if [ ! -z "$USER_GROQ_KEY" ]; then
    export GROQ_API_KEY=$USER_GROQ_KEY
fi

echo "Building and starting production containers..."
sudo -E docker compose -f docker-compose.prod.yml up -d --build

echo "Deployment complete! Application will be available at http://$AWS_PUBLIC_IP:3000"
