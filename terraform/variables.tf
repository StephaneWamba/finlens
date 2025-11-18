variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "infrastructure_active" {
  description = "Whether infrastructure should be active (true) or paused (false)"
  type        = bool
  default     = true
}

variable "mongodb_dev_access_ips" {
  description = "List of IP addresses (CIDR blocks) allowed to access MongoDB for development. Empty list means no external access."
  type        = list(string)
  default     = []
}

# Database credentials
variable "mongodb_username" {
  description = "MongoDB master username"
  type        = string
  sensitive   = true
  default     = "syntera_admin"
}

variable "mongodb_password" {
  description = "MongoDB master password"
  type        = string
  sensitive   = true
}

variable "mongodb_instance_class" {
  description = "MongoDB instance class"
  type        = string
  default     = "db.t3.small"  # Smallest DocumentDB instance
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "rabbitmq_username" {
  description = "RabbitMQ username"
  type        = string
  sensitive   = true
  default     = "admin"
}

variable "rabbitmq_password" {
  description = "RabbitMQ password"
  type        = string
  sensitive   = true
}

variable "rabbitmq_instance_type" {
  description = "RabbitMQ instance type"
  type        = string
  default     = "mq.t3.micro"
}

variable "create_state_bucket" {
  description = "Whether to create the Terraform state bucket (set to false if already exists)"
  type        = bool
  default     = false
}

# Bastion Host Configuration
variable "create_bastion" {
  description = "Whether to create a bastion host for development access"
  type        = bool
  default     = true
}

variable "bastion_instance_type" {
  description = "EC2 instance type for bastion host"
  type        = string
  default     = "t3.micro"  # Smaller and better than t2.micro
}

variable "bastion_allowed_ips" {
  description = "List of IP addresses (CIDR blocks) allowed to SSH into bastion host. Use your public IP. Example: [\"1.2.3.4/32\"]"
  type        = list(string)
  default     = []
}

variable "bastion_key_name" {
  description = "Name of AWS EC2 Key Pair to use for bastion host SSH access. Create one in AWS Console if needed."
  type        = string
  default     = ""
}

