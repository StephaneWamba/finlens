# Bastion Host for Development Access
# Allows secure SSH tunneling to access private resources (MongoDB, Redis, RabbitMQ)

# Security Group for Bastion Host
resource "aws_security_group" "bastion" {
  count       = var.create_bastion ? 1 : 0
  name        = "syntera-bastion-sg-${var.environment}"
  description = "Security group for bastion host - allows SSH from specified IPs"
  vpc_id      = aws_vpc.main.id

  # Allow SSH from specified IP addresses
  dynamic "ingress" {
    for_each = var.bastion_allowed_ips
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "SSH access from ${ingress.value}"
    }
  }

  # Allow outbound traffic (needed for SSH tunneling)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "syntera-bastion-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM Role for Bastion Host (for CloudWatch logs, SSM, etc.)
resource "aws_iam_role" "bastion" {
  count = var.create_bastion ? 1 : 0
  name  = "syntera-bastion-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "syntera-bastion-role-${var.environment}"
  }
}

# Attach SSM policy for easier access (optional but recommended)
resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  count      = var.create_bastion ? 1 : 0
  role       = aws_iam_role.bastion[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile for Bastion
resource "aws_iam_instance_profile" "bastion" {
  count = var.create_bastion ? 1 : 0
  name  = "syntera-bastion-profile-${var.environment}"
  role  = aws_iam_role.bastion[0].name

  tags = {
    Name = "syntera-bastion-profile-${var.environment}"
  }
}

# Elastic IP for Bastion (so IP doesn't change)
resource "aws_eip" "bastion" {
  count  = var.infrastructure_active && var.create_bastion ? 1 : 0
  domain = "vpc"

  tags = {
    Name = "syntera-bastion-eip-${var.environment}"
  }
}

# Bastion Host EC2 Instance
resource "aws_instance" "bastion" {
  count         = var.infrastructure_active && var.create_bastion ? 1 : 0
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.bastion_instance_type
  subnet_id     = aws_subnet.public[0].id

  vpc_security_group_ids = [aws_security_group.bastion[0].id]
  iam_instance_profile   = aws_iam_instance_profile.bastion[0].name

  # Use AWS-managed key pair or create one
  key_name = var.bastion_key_name

  # User data to install and configure SSH
  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y htop net-tools
    
    # Enable SSH forwarding for tunneling
    echo "GatewayPorts yes" >> /etc/ssh/sshd_config
    systemctl restart sshd
  EOF

  tags = {
    Name = "syntera-bastion-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Associate Elastic IP with Bastion
resource "aws_eip_association" "bastion" {
  count       = var.infrastructure_active && var.create_bastion ? 1 : 0
  instance_id = aws_instance.bastion[0].id
  allocation_id = aws_eip.bastion[0].id
}

# Update MongoDB Security Group to allow access from Bastion
resource "aws_security_group_rule" "mongodb_from_bastion" {
  count                    = var.infrastructure_active && var.create_bastion ? 1 : 0
  type                     = "ingress"
  from_port                = 27017
  to_port                  = 27017
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.bastion[0].id
  security_group_id        = aws_security_group.mongodb.id
  description              = "Allow MongoDB access from bastion host"
}

# Update Redis Security Group to allow access from Bastion
resource "aws_security_group_rule" "redis_from_bastion" {
  count                    = var.infrastructure_active && var.create_bastion ? 1 : 0
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.bastion[0].id
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis access from bastion host"
}

# Update RabbitMQ Security Group to allow access from Bastion
resource "aws_security_group_rule" "rabbitmq_from_bastion_amqp" {
  count                    = var.infrastructure_active && var.create_bastion ? 1 : 0
  type                     = "ingress"
  from_port                = 5672
  to_port                  = 5672
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.bastion[0].id
  security_group_id        = aws_security_group.rabbitmq.id
  description              = "Allow RabbitMQ AMQP access from bastion host"
}

resource "aws_security_group_rule" "rabbitmq_from_bastion_management" {
  count                    = var.infrastructure_active && var.create_bastion ? 1 : 0
  type                     = "ingress"
  from_port                = 15672
  to_port                  = 15672
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.bastion[0].id
  security_group_id        = aws_security_group.rabbitmq.id
  description              = "Allow RabbitMQ management UI access from bastion host"
}

