output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "mongodb_endpoint" {
  description = "MongoDB cluster endpoint"
  value       = var.infrastructure_active ? aws_docdb_cluster.main[0].endpoint : "Infrastructure paused"
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = var.infrastructure_active ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : "Infrastructure paused"
}

output "rabbitmq_endpoint" {
  description = "RabbitMQ endpoint"
  value       = var.infrastructure_active ? aws_mq_broker.rabbitmq[0].instances[0].endpoints[0] : "Infrastructure paused"
}

output "s3_logs_bucket" {
  description = "S3 bucket for logs"
  value       = aws_s3_bucket.logs.id
}

output "bastion_public_ip" {
  description = "Public IP address of bastion host"
  value       = var.infrastructure_active && var.create_bastion ? aws_eip.bastion[0].public_ip : "Bastion not created"
}

output "bastion_ssh_command" {
  description = "SSH command to connect to bastion host"
  value = var.infrastructure_active && var.create_bastion && var.bastion_key_name != "" ? "ssh -i ~/.ssh/${var.bastion_key_name}.pem ec2-user@${aws_eip.bastion[0].public_ip}" : "Configure bastion_key_name to get SSH command"
}

output "bastion_tunnel_commands" {
  description = "SSH tunnel commands for port forwarding to databases"
  value = var.infrastructure_active && var.create_bastion ? {
    mongodb = "ssh -i ~/.ssh/${var.bastion_key_name}.pem -L 27017:${var.infrastructure_active ? aws_docdb_cluster.main[0].endpoint : "N/A"}:27017 -N ec2-user@${aws_eip.bastion[0].public_ip}"
    redis   = "ssh -i ~/.ssh/${var.bastion_key_name}.pem -L 6379:${var.infrastructure_active ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : "N/A"}:6379 -N ec2-user@${aws_eip.bastion[0].public_ip}"
    rabbitmq = "ssh -i ~/.ssh/${var.bastion_key_name}.pem -L 5672:${var.infrastructure_active ? split(":", replace(aws_mq_broker.rabbitmq[0].instances[0].endpoints[0], "amqps://", ""))[0] : "N/A"}:5671 -N ec2-user@${aws_eip.bastion[0].public_ip}"
  } : {}
}

