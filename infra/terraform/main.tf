# PropAgent AI — AWS Infrastructure (Terraform)
# Provisions: VPC, ECS, RDS, Elasticache, ALB

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  required_version = ">= 1.5"
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region"   { default = "us-east-1" }
variable "app_name"     { default = "propagent" }
variable "db_password"  { sensitive = true }
variable "openai_key"   { sensitive = true }

locals {
  name = var.app_name
  tags = { Project = "PropAgent AI", Environment = "production" }
}
