import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { GitHubActionsRole } from './github-actions-role';

export interface InternotiStackProps extends cdk.StackProps {}

export class InternotiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: InternotiStackProps) {
    super(scope, id, props);

    // Create GitHub Actions role
    new GitHubActionsRole(this, 'GitHubActions');

    // Use existing ECR Repository
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'InternotiRepository',
      'internoti'
    );

    // Create VPC (using default VPC for simplicity)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    // Create IAM role for EC2 instance
    const role = new iam.Role(this, 'InternotiInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
      ],
    });

    // Add policy to access Parameter Store
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/internoti/*`,
      ],
    }));

    // Add policy for ECR access
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'], // GetAuthorizationToken requires resource '*'
    }));

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
      ],
      resources: [repository.repositoryArn],
    }));

    // Create security group
    const securityGroup = new ec2.SecurityGroup(this, 'InternotiSecurityGroup', {
      vpc,
      description: 'Security group for Internoti instance',
      allowAllOutbound: true,
    });

    // Allow SSH access
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access from anywhere'
    );

    // Add SSM policy for managing EC2 instances
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:SendCommand',
        'ssm:GetCommandInvocation'
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:document/AWS-RunShellScript`,
        `arn:aws:ec2:${this.region}:${this.account}:instance/*`
      ]
    }));

    // Output the ECR repository URI only
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'URI of the ECR repository',
    });
  }
}